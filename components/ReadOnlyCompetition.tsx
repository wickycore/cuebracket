"use client";

import { useEffect, useState } from "react";
import { ChampionCelebration } from "@/components/ChampionCelebration";
import { ReadOnlyBracket } from "@/components/ReadOnlyBracket";
import { FreeForAllStandingsTable, StandingsTable } from "@/components/StandingsTable";
import {
  type BracketRound,
  formatDuration,
  getFormatLabel,
  getTournamentChampionDescription,
  type Tournament,
} from "@/lib/tournaments";

const TABLE_RULES = "Ranking: points → recursive head-to-head mini-table → head-to-head frame difference → overall frame difference → frames won → wins. An unresolved first-place tie requires a championship playoff.";
const SWISS_RULES = "Ranking: match points → Buchholz (opponents’ earned points) → frame difference → frames won. A BYE awards the configured win points but is tracked separately; it does not increase played matches (P) or on-table wins (W).";

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function MatchTimer({ startedAt, endedAt }: { startedAt?: string | null; endedAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, endedAt]);
  if (!startedAt) return null;
  const endTime = endedAt ? new Date(endedAt).getTime() : now;
  return <span className="text-[11px] font-bold tabular-nums text-slate-400">{formatDuration(endTime - new Date(startedAt).getTime())}</span>;
}

function ReadOnlyRounds({ rounds, raceTo, byePoints }: { rounds: BracketRound[]; raceTo: number; byePoints?: number }) {
  return (
    <div className="space-y-5">
      {rounds.map((round) => {
        const playableMatches = round.matches.filter((match) => match.player1 && match.player2);
        const byeMatches = round.matches.filter((match) => Boolean(match.player1) !== Boolean(match.player2));
        return (
          <section key={`${round.name}-${round.round}`} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black text-white">{round.name}</h3>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400 ring-1 ring-white/10">
                {playableMatches.filter((match) => match.completed).length}/{playableMatches.length} played matches complete
              </span>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {playableMatches.map((match, index) => (
                <article key={match.id} className={`overflow-hidden rounded-2xl border bg-slate-950/65 ${match.completed ? "border-emerald-400/25" : "border-white/10"}`}>
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                    <span className="text-[0.64rem] font-black uppercase tracking-wider text-slate-400">{match.tableNumber ? `Table ${match.tableNumber}` : `Match ${index + 1}`}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${match.completed ? "bg-emerald-400/10 text-emerald-300" : match.status === "live" ? "bg-rose-400/15 text-rose-300" : "bg-cyan-400/10 text-cyan-300"}`}>
                      {match.completed ? "Finished" : match.status === "live" ? "● Live" : `Race to ${raceTo}`}
                    </span>
                  </div>
                  {[match.player1, match.player2].map((player, playerIndex) => {
                    const isWinner = Boolean(player && match.completed && match.winner === player);
                    return (
                      <div key={`${match.id}-${playerIndex}`} className={`flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 ${isWinner ? "bg-emerald-400/10" : ""}`}>
                        <span className={`min-w-0 flex-1 truncate font-black ${isWinner ? "text-emerald-300" : "text-white"}`}>{player}</span>
                        <span className="text-lg font-black tabular-nums text-cyan-300">{(playerIndex === 0 ? match.score1 : match.score2) ?? "—"}</span>
                      </div>
                    );
                  })}
                  {match.startedAt ? <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-400"><span>Race to {raceTo}</span><MatchTimer startedAt={match.startedAt} endedAt={match.endedAt} /></div> : null}
                </article>
              ))}
              {byeMatches.map((match) => {
                const player = match.player1 ?? match.player2;
                return (
                  <article key={match.id} className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-4">
                    <p className="text-[0.64rem] font-black uppercase tracking-wider text-violet-300">{byePoints === undefined ? "Rest round" : "Automatic BYE"}</p>
                    <p className="mt-1 font-black text-white">{player}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {byePoints === undefined
                        ? "No fixture this round. No match or points recorded."
                        : `One win and ${formatPoints(byePoints)} point${byePoints === 1 ? "" : "s"}; tracked separately from played matches.`}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ReadOnlyCompetition({ tournament, showChampion = true }: { tournament: Tournament; showChampion?: boolean }) {
  const competition = tournament.competition;
  if (!competition) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
        <p className="text-4xl">⚙️</p>
        <h2 className="mt-3 text-2xl font-black">Competition not generated yet</h2>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {showChampion && competition.champion ? <ChampionCelebration champion={competition.champion} description={getTournamentChampionDescription(tournament)} tournament={tournament} /> : null}
      {"championshipTiePlayers" in competition &&
      !competition.champion &&
      (competition.championshipTiePlayers?.length ?? 0) > 1 ? (
        <section className="space-y-4 rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.06] p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Championship playoff live</p>
            <p className="mt-2 text-sm text-slate-300">The standings could not separate {competition.championshipTiePlayers?.join(", ")}. Their official playoff fixtures decide the champion.</p>
          </div>
          <StandingsTable rows={competition.playoffStandings} title="Playoff standings" rules={TABLE_RULES} />
          <ReadOnlyRounds rounds={competition.playoffRounds} raceTo={tournament.raceTo} />
        </section>
      ) : null}

      {competition.type === "round_robin" ? (
        <>
          <StandingsTable rows={competition.standings} title={getFormatLabel(tournament.format)} rules={TABLE_RULES} />
          <ReadOnlyRounds rounds={competition.rounds} raceTo={tournament.raceTo} />
          {competition.playoffRounds.length ? (
            <section className="space-y-5 rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.05] p-5 sm:p-6">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Championship playoff</p>
                <p className="mt-2 text-sm text-slate-400">The regular table could not separate first place. The champion will be decided here.</p>
              </div>
              <StandingsTable rows={competition.playoffStandings} title="Playoff standings" rules={TABLE_RULES} />
              <ReadOnlyRounds rounds={competition.playoffRounds} raceTo={tournament.raceTo} />
            </section>
          ) : null}
        </>
      ) : null}

      {competition.type === "swiss" ? (
        <>
          <StandingsTable rows={competition.standings} showBuchholz showByes title={`Swiss standings · Round ${competition.currentRound}/${competition.totalRounds}`} rules={SWISS_RULES} />
          <ReadOnlyRounds rounds={competition.rounds} raceTo={tournament.raceTo} byePoints={tournament.options.pointsForWin} />
        </>
      ) : null}

      {competition.type === "leaderboard" ? (
        <>
          <StandingsTable rows={competition.standings} title="Live leaderboard" rules="Ranking: total points → head-to-head mini-table → frame difference → frames won → wins. Bonus and penalty adjustments are included." />
          <ReadOnlyRounds rounds={competition.rounds} raceTo={tournament.raceTo} />
        </>
      ) : null}

      {competition.type === "free_for_all" ? (
        <>
          <FreeForAllStandingsTable rows={competition.standings} rules="Ranking: placement points → heat wins → podiums → best average finish → raw score." />
          <div className="grid gap-4 lg:grid-cols-2">
            {competition.heats.map((heat) => (
              <article key={heat.id} className={`overflow-hidden rounded-2xl border bg-slate-950/65 ${heat.completed ? "border-emerald-400/25" : "border-white/10"}`}>
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="font-black">{heat.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${heat.completed ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-400"}`}>{heat.completed ? "Finished" : "Waiting"}</span>
                </div>
                {heat.entries
                  .slice()
                  .sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999) || (b.score ?? 0) - (a.score ?? 0))
                  .map((entry) => (
                    <div key={entry.player} className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                      <span className="w-8 text-sm font-black text-slate-400">{entry.placement ? `#${entry.placement}` : "—"}</span>
                      <span className="min-w-0 flex-1 truncate font-black text-white">{entry.player}</span>
                      {heat.completed ? <span className="text-xs font-bold text-slate-400">{formatPoints(entry.points)} pts</span> : null}
                      <span className="font-black text-cyan-300">{entry.score ?? "—"}</span>
                    </div>
                  ))}
              </article>
            ))}
          </div>
        </>
      ) : null}

      {competition.type === "two_stage" ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            {competition.groups.map((group) => (
              <div key={group.id} className="space-y-4">
                <StandingsTable rows={group.standings} title={`${group.name} standings`} rules={TABLE_RULES} />
                {(group.qualificationTiePlayers?.length ?? 0) > 1 ? (
                  <section className="space-y-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                    <p className="text-sm font-bold text-amber-100">Qualification playoff in progress.</p>
                    <StandingsTable rows={group.qualificationPlayoffStandings ?? []} title="Playoff standings" rules={TABLE_RULES} />
                    <ReadOnlyRounds rounds={group.qualificationPlayoffRounds ?? []} raceTo={tournament.raceTo} />
                  </section>
                ) : null}
                <ReadOnlyRounds rounds={group.rounds} raceTo={tournament.raceTo} />
              </div>
            ))}
          </div>
          {competition.finalBracket ? (
            <section className="space-y-4">
              <div className="rounded-[2rem] border border-violet-400/20 bg-violet-400/[0.06] p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">Final stage</p>
                <h3 className="mt-2 text-2xl font-black">{competition.finalFormat === "double" ? "Double elimination" : "Single elimination"}</h3>
                <p className="mt-2 text-sm text-slate-400">Opening matches use crossover seeding to reward group winners and avoid immediate same-group rematches whenever possible.</p>
              </div>
              <ReadOnlyBracket tournament={tournament} bracket={competition.finalBracket} showChampion={false} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
