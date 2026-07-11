"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  BracketMatch,
  BracketRound,
  DoubleEliminationBracket,
  Tournament,
  updateTournament,
  formatDuration,
} from "@/lib/tournaments";
import {
  buildDoubleEliminationBracket,
  updateDoubleMatch,
} from "@/lib/bracket/doubleElimination";
import {
  BracketConnections,
  useBracketMatchRefs,
  type ConnectorTone,
} from "@/components/BracketConnections";
import { BracketViewport } from "@/components/BracketViewport";
import { ChampionCelebration } from "@/components/ChampionCelebration";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

type BracketTone = "winners" | "losers" | "final";

const connectorTone: Record<BracketTone, ConnectorTone> = {
  winners: "cyan",
  losers: "rose",
  final: "violet",
};

const toneStyles: Record<BracketTone, { title: string; active: string; panel: string }> = {
  winners: {
    title: "text-cyan-300",
    active: "border-cyan-400/40",
    panel: "from-cyan-400/[0.08] via-slate-950/90 to-slate-950/95",
  },
  losers: {
    title: "text-rose-300",
    active: "border-rose-400/40",
    panel: "from-rose-400/[0.07] via-slate-950/90 to-slate-950/95",
  },
  final: {
    title: "text-violet-300",
    active: "border-violet-400/40",
    panel: "from-violet-400/[0.09] via-slate-950/90 to-slate-950/95",
  },
};

function MatchCard({
  match,
  raceTo,
  draft,
  setDraft,
  save,
  undo,
  tone,
}: {
  match: BracketMatch;
  raceTo: number;
  draft: { score1: string; score2: string };
  setDraft: (value: { score1: string; score2: string }) => void;
  save: () => void;
  undo: () => void;
  tone: BracketTone;
}) {
  const playable = Boolean(match.player1 && match.player2);
  const styles = toneStyles[tone];
  const isLive = match.status === "live";
  const duration = match.startedAt
    ? formatDuration(new Date(match.endedAt ?? Date.now()).getTime() - new Date(match.startedAt).getTime())
    : null;

  return (
    <article
      className={`group relative z-10 overflow-hidden rounded-xl border bg-slate-950/95 shadow-[0_14px_40px_rgba(0,0,0,.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(0,0,0,.38)] ${
        match.completed
          ? "border-emerald-400/45 shadow-[0_0_24px_rgba(52,211,153,.08)]"
          : isLive
            ? `${styles.active} shadow-[0_0_30px_rgba(34,211,238,.12)]`
            : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {match.tableNumber ? `Table ${match.tableNumber}` : `Match ${match.position}`}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
          match.completed
            ? "bg-emerald-400/10 text-emerald-300"
            : isLive
              ? "animate-pulse bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30"
              : playable
                ? "bg-cyan-400/10 text-cyan-300"
                : "bg-white/5 text-slate-500"
        }`}>
          {match.completed ? "Finished" : isLive ? "● Live" : playable ? "Ready" : "Waiting"}
        </span>
      </div>
      {[match.player1, match.player2].map((player, index) => {
        const isWinner = Boolean(match.completed && player && match.winner === player);
        const score = index === 0 ? draft.score1 : draft.score2;

        return (
          <div
            key={index}
            className={`flex min-h-12 items-center gap-3 border-b border-white/10 px-3 py-2.5 last:border-b-0 ${
              isWinner ? "bg-emerald-400/10" : ""
            }`}
          >
            <span
              className={`min-w-0 flex-1 truncate text-sm font-extrabold ${
                isWinner ? "text-emerald-300" : player ? "text-white" : "text-slate-600"
              }`}
            >
              {player ?? "TBD"}
            </span>

            {playable ? (
              <input
                inputMode="numeric"
                value={score}
                onChange={(event) =>
                  setDraft(
                    index === 0
                      ? { ...draft, score1: event.target.value }
                      : { ...draft, score2: event.target.value },
                  )
                }
                aria-label={`Score for ${player ?? `player ${index + 1}`}`}
                className="h-8 w-12 rounded-lg border border-white/10 bg-slate-900 px-1 text-center text-sm font-black text-white outline-none focus:border-cyan-400/60"
              />
            ) : (
              <span className="text-xs font-bold text-slate-600">—</span>
            )}
          </div>
        );
      })}

      <div className="flex min-h-10 items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0 truncate text-[11px] font-bold text-slate-500">
          {match.completed
            ? `Winner: ${match.winner}${duration ? ` · ${duration}` : ""}`
            : playable
              ? `Race to ${raceTo}${duration ? ` · ${duration}` : ""}`
              : "Waiting for players"}
        </span>

        {playable ? (
          <div className="flex gap-1.5">
            {match.completed ? (
              <button
                onClick={undo}
                className="rounded-md px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Undo
              </button>
            ) : null}
            <button
              onClick={save}
              className="rounded-md bg-cyan-400 px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-cyan-300"
            >
              Save
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BracketRoundColumn({
  round,
  title,
  tournament,
  drafts,
  setDrafts,
  saveResult,
  clearResult,
  tone,
  maxMatches,
  registerMatch,
}: {
  round: BracketRound;
  title: string;
  tournament: Tournament;
  drafts: Record<string, { score1: string; score2: string }>;
  setDrafts: Dispatch<SetStateAction<Record<string, { score1: string; score2: string }>>>;
  saveResult: (match: BracketMatch) => void;
  clearResult: (match: BracketMatch) => void;
  tone: BracketTone;
  maxMatches: number;
  registerMatch: (matchId: string, node: HTMLDivElement | null) => void;
}) {
  const ratio = Math.max(1, Math.floor(maxMatches / Math.max(1, round.matches.length)));
  const topPadding = ratio > 1 ? Math.min(96, (ratio - 1) * 28) : 0;
  const gap = ratio > 1 ? Math.min(120, ratio * 30) : 18;

  return (
    <div className="w-64 shrink-0 snap-start">
      <p className="mb-4 text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">
        {round.name}
      </p>

      <div style={{ paddingTop: topPadding }} className="relative">
        <div className="space-y-0" style={{ display: "grid", gap }}>
          {round.matches.map((match) => {
            const draft = drafts[match.id] ?? {
              score1: match.score1?.toString() ?? "",
              score2: match.score2?.toString() ?? "",
            };

            return (
              <div
                key={match.id}
                ref={(node) => registerMatch(match.id, node)}
                className="relative z-10"
              >
                <MatchCard
                  match={match}
                  raceTo={tournament.raceTo}
                  draft={draft}
                  setDraft={(value) =>
                    setDrafts((current) => ({ ...current, [match.id]: value }))
                  }
                  save={() => saveResult(match)}
                  undo={() => clearResult(match)}
                  tone={tone}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BracketSection({
  title,
  subtitle,
  rounds,
  tournament,
  drafts,
  setDrafts,
  saveResult,
  clearResult,
  tone,
}: {
  title: string;
  subtitle: string;
  rounds: BracketRound[];
  tournament: Tournament;
  drafts: Record<string, { score1: string; score2: string }>;
  setDrafts: Dispatch<SetStateAction<Record<string, { score1: string; score2: string }>>>;
  saveResult: (match: BracketMatch) => void;
  clearResult: (match: BracketMatch) => void;
  tone: BracketTone;
}) {
  const styles = toneStyles[tone];
  const maxMatches = Math.max(1, ...rounds.map((round) => round.matches.length));
  const contentRef = useRef<HTMLDivElement>(null);
  const { matchRefs, registerMatch } = useBracketMatchRefs();

  return (
    <section
      className={`overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${styles.panel}`}
    >
      <header className="flex flex-col gap-1 border-b border-white/10 px-5 py-5 sm:px-7">
        <p className={`text-sm font-black uppercase tracking-[0.22em] ${styles.title}`}>{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </header>

      <BracketViewport label={title}>
        <div
          ref={contentRef}
          className="relative flex min-w-max snap-x snap-mandatory items-start gap-14 pb-4 pr-12"
        >
          <BracketConnections
            rounds={rounds}
            containerRef={contentRef}
            matchRefs={matchRefs}
            tone={connectorTone[tone]}
          />
          {rounds.map((round) => (
            <BracketRoundColumn
              key={`${title}-${round.round}`}
              round={round}
              title={title}
              tournament={tournament}
              drafts={drafts}
              setDrafts={setDrafts}
              saveResult={saveResult}
              clearResult={clearResult}
              tone={tone}
              maxMatches={maxMatches}
              registerMatch={registerMatch}
            />
          ))}
        </div>
      </BracketViewport>
    </section>
  );
}

export function DoubleEliminationManager({ tournament, onTournamentChange }: Props) {
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { score1: string; score2: string }>>({});
  const bracket = tournament.bracket?.type === "double" ? tournament.bracket : undefined;

  const completed = useMemo(() => {
    if (!bracket) return 0;
    return [...bracket.winners, ...bracket.losers, ...bracket.grandFinal]
      .flatMap((round) => round.matches)
      .filter((match) => match.completed && match.player1 && match.player2).length;
  }, [bracket]);

  const totalPlayable = useMemo(() => {
    if (!bracket) return 0;
    return [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired),
    ].flatMap((round) => round.matches).length;
  }, [bracket]);

  const progress = totalPlayable ? Math.min(100, Math.round((completed / totalPlayable) * 100)) : 0;

  function saveBracket(next: DoubleEliminationBracket | undefined) {
    const updated = updateTournament(tournament.id, {
      bracket: next,
      status: next ? "live" : "draft",
    });
    if (updated) onTournamentChange(updated);
  }

  function generate() {
    if (tournament.players.length < 2) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }
    setMessage("");
    saveBracket(buildDoubleEliminationBracket(tournament));
  }

  function saveResult(match: BracketMatch) {
    if (!bracket || !match.player1 || !match.player2) return;
    const draft = drafts[match.id] ?? {
      score1: match.score1?.toString() ?? "",
      score2: match.score2?.toString() ?? "",
    };
    const score1 = Number(draft.score1);
    const score2 = Number(draft.score2);

    if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
      setMessage("Scores must be whole numbers of zero or more.");
      return;
    }
    if (score1 === score2) {
      setMessage("A match cannot finish as a draw.");
      return;
    }

    setMessage("");
    saveBracket(
      updateDoubleMatch(bracket, match.id, (target) => {
        target.score1 = score1;
        target.score2 = score2;
        target.winner = score1 > score2 ? target.player1 : target.player2;
        target.completed = true;
        target.status = "finished";
        target.endedAt = new Date().toISOString();
      }),
    );
  }

  function clearResult(match: BracketMatch) {
    if (!bracket) return;
    setDrafts((current) => ({ ...current, [match.id]: { score1: "", score2: "" } }));
    saveBracket(
      updateDoubleMatch(bracket, match.id, (target) => {
        target.score1 = null;
        target.score2 = null;
        target.winner = null;
        target.completed = false;
        target.status = "pending";
        target.endedAt = null;
      }),
    );
  }

  if (!bracket) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
        <div className="text-4xl">♻️</div>
        <h2 className="mt-4 text-2xl font-black">Generate the double-elimination bracket</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          Each player is eliminated only after a second loss. BYEs advance automatically.
        </p>
        {message ? <p className="mt-4 text-sm font-bold text-amber-300">{message}</p> : null}
        <button
          onClick={generate}
          className="mt-7 rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 hover:bg-cyan-300"
        >
          Generate double bracket
        </button>
      </section>
    );
  }

  const grandFinalRounds = bracket.grandFinal.filter(
    (round) => round.round === 1 || bracket.resetRequired,
  );

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">Double elimination</p>
          <h2 className="mt-2 text-2xl font-black">Separated winners and losers brackets</h2>
          <p className="mt-2 text-sm text-slate-400">
            {completed} completed matches · {bracket.champion ? `Champion: ${bracket.champion}` : bracket.resetRequired ? "Bracket reset required" : "Tournament in progress"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={bracket.bracketResetEnabled}
              onChange={(event) =>
                saveBracket({ ...bracket, bracketResetEnabled: event.target.checked })
              }
            />
            Grand-final reset
          </label>
          <button
            onClick={() => {
              if (window.confirm("Reset this bracket and remove all scores?")) saveBracket(undefined);
            }}
            className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
          >
            Reset bracket
          </button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Tournament progress</p>
            <p className="mt-1 text-sm font-bold text-white">{completed} of {totalPlayable} playable matches completed</p>
          </div>
          <p className="text-2xl font-black tabular-nums text-cyan-300">{progress}%</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {message ? (
        <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 ring-1 ring-amber-400/20">
          {message}
        </p>
      ) : null}

      {bracket.champion ? <ChampionCelebration champion={bracket.champion} /> : null}

      <BracketSection
        title="Winners Bracket"
        subtitle="Players remain here until their first loss."
        rounds={bracket.winners}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="winners"
      />

      <BracketSection
        title="Losers Bracket"
        subtitle="A second loss eliminates the player from the tournament."
        rounds={bracket.losers}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="losers"
      />

      <BracketSection
        title="Grand Final"
        subtitle={bracket.resetRequired ? "The reset match is now active." : "Winners champion versus losers champion."}
        rounds={grandFinalRounds}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="final"
      />
    </section>
  );
}
