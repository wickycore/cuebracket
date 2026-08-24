"use client";

import { useEffect, useMemo, useState } from "react";

import type { BracketMatch, BracketRound } from "@/lib/tournaments";

type QueueTab = "live" | "ready" | "waiting" | "completed";

export interface OrganizerMatchSection {
  name: string;
  tone: "cyan" | "rose" | "violet";
  rounds: BracketRound[];
}

interface QueueItem {
  match: BracketMatch;
  section: OrganizerMatchSection;
  roundName: string;
  matchNumber: number;
  tab: QueueTab;
}

const tabLabels: Record<QueueTab, string> = {
  live: "Live",
  ready: "Ready",
  waiting: "Waiting",
  completed: "Completed",
};

const toneClasses: Record<OrganizerMatchSection["tone"], string> = {
  cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  rose: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
};

function classify(match: BracketMatch): QueueTab | null {
  const hasBothPlayers = Boolean(match.player1 && match.player2);
  if (match.completed) return hasBothPlayers ? "completed" : null;
  if (match.status === "live" && hasBothPlayers) return "live";
  if (hasBothPlayers) return "ready";
  return "waiting";
}

export function OrganizerMatchQueue({
  sections,
  selectedMatchId,
  onSelectMatch,
  publicUrl,
}: {
  sections: OrganizerMatchSection[];
  selectedMatchId?: string;
  onSelectMatch: (matchId: string) => void;
  publicUrl: string;
}) {
  const items = useMemo(
    () =>
      sections.flatMap((section) =>
        section.rounds.flatMap((round) =>
          round.matches.flatMap((match, index) => {
            const tab = classify(match);
            return tab
              ? [{ match, section, roundName: round.name, matchNumber: index + 1, tab }]
              : [];
          }),
        ),
      ),
    [sections],
  );

  const counts = useMemo(
    () =>
      items.reduce<Record<QueueTab, number>>(
        (result, item) => ({ ...result, [item.tab]: result[item.tab] + 1 }),
        { live: 0, ready: 0, waiting: 0, completed: 0 },
      ),
    [items],
  );
  const suggestedTab: QueueTab = counts.live ? "live" : counts.ready ? "ready" : counts.waiting ? "waiting" : "completed";
  const [tab, setTab] = useState<QueueTab>(suggestedTab);
  const visibleItems = items.filter((item) => item.tab === tab);

  useEffect(() => {
    if (counts[tab] === 0 && counts[suggestedTab] > 0) setTab(suggestedTab);
  }, [counts, suggestedTab, tab]);

  function controlMatch(matchId: string) {
    onSelectMatch(matchId);
    document.getElementById("live-match-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Match queue</p>
          <h2 className="mt-2 text-2xl font-black text-white">What needs attention</h2>
          <p className="mt-1 text-sm text-slate-400">Choose a ready match, control it above, then move straight to the next one.</p>
        </div>
        <a
          data-cb-hard-navigation="true"
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-black text-cyan-200 hover:bg-cyan-400/15"
        >
          View full bracket ↗
        </a>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1.5">
        {(Object.keys(tabLabels) as QueueTab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-xl px-2 py-2.5 text-xs font-black transition sm:text-sm ${
              tab === value ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tabLabels[value]} <span className="opacity-70">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visibleItems.map(({ match, section, roundName, matchNumber }) => {
          const selected = match.id === selectedMatchId;
          const showScore = match.completed || match.status === "live";
          return (
            <article
              key={match.id}
              className={`rounded-2xl border p-4 transition ${selected ? "border-cyan-400/50 bg-cyan-400/[0.07]" : "border-white/10 bg-slate-950/45"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {sections.length > 1 ? (
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses[section.tone]}`}>
                      {section.name}
                    </span>
                  ) : null}
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {roundName} · Match {matchNumber}
                  </span>
                </div>
                {match.tableNumber ? <span className="text-xs font-bold text-amber-200">{match.tableNumber}</span> : null}
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                <p className="truncate font-black text-white">{match.player1 ?? "TBD"}</p>
                {showScore ? <p className="text-xl font-black text-cyan-300">{match.score1 ?? 0}</p> : <span />}
                <p className="truncate font-black text-white">{match.player2 ?? "TBD"}</p>
                {showScore ? <p className="text-xl font-black text-cyan-300">{match.score2 ?? 0}</p> : <span />}
              </div>

              {match.completed ? (
                <p className="mt-3 text-xs font-bold text-emerald-300">Winner: {match.winner}</p>
              ) : match.player1 && match.player2 ? (
                <button
                  type="button"
                  onClick={() => controlMatch(match.id)}
                  className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
                >
                  {match.status === "live" ? "Return to live match" : "Control match"}
                </button>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Waiting for feeder results.</p>
              )}
            </article>
          );
        })}

        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500 lg:col-span-2">
            No {tabLabels[tab].toLowerCase()} matches.
          </div>
        ) : null}
      </div>
    </section>
  );
}
