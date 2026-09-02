"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChampionCelebration } from "@/components/ChampionCelebration";
import { PlayerNameEditor } from "@/components/PlayerNameEditor";
import { FreeForAllStandingsTable, StandingsTable } from "@/components/StandingsTable";
import { recordMatchStarted } from "@/lib/cloud/notifications";
import {
  assignVenueTable,
  getEventVenueTables,
  releaseVenueTable,
  subscribeToVenueTables,
  type VenueTableRow,
} from "@/lib/cloud/tables";
import { buildTournamentCompetition } from "@/lib/competition";
import { isValidRaceResult } from "@/lib/bracket/singleElimination";
import { clearFreeForAllHeat, FREE_FOR_ALL_PLAYOFF_OPTIONS, updateFreeForAllHeat, updateFreeForAllPlayoffMatch } from "@/lib/competition/freeForAll";
import { generateChampionshipPlayoffRematch } from "@/lib/competition/common";
import { setLeaderboardAdjustment, updateLeaderboardMatch } from "@/lib/competition/leaderboard";
import { generateRoundRobinPlayoffRematch, updateRoundRobinMatch } from "@/lib/competition/roundRobin";
import { canGenerateNextSwissRound, generateNextSwissRound, updateSwissMatch } from "@/lib/competition/swiss";
import {
  areTwoStageGroupsComplete,
  areTwoStageQualificationTiesResolved,
  generateTwoStageFinals,
  generateTwoStageQualificationPlayoffRematch,
  updateTwoStageFinalMatch,
  updateTwoStageGroupMatch,
} from "@/lib/competition/twoStage";
import {
  type BracketMatch,
  type BracketRound,
  type FreeForAllCompetition,
  formatDuration,
  getBracketRounds,
  getFormatLabel,
  getTournamentChampionDescription,
  type LeaderboardCompetition,
  type Tournament,
  type TournamentCompetition,
  updateTournament,
} from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

type DraftScore = { score1: string; score2: string };

const TABLE_RULES = "Ranking: points → recursive head-to-head mini-table → head-to-head frame difference → overall frame difference → frames won → wins. An unresolved first-place tie requires a championship playoff.";
const SWISS_RULES = "Ranking: match points → Buchholz (opponents’ earned points) → frame difference → frames won. A BYE awards the configured win points but is tracked separately; it does not increase played matches (P) or on-table wins (W).";

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

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function tieRuleLabel(rule: FreeForAllCompetition["tieRule"]) {
  if (rule === "full_points") return "Ties receive full placement points";
  if (rule === "tiebreak_required") return "Tied heat scores require a tiebreak";
  return "Tied placements split the occupied points";
}

function minimumPlayers(tournament: Tournament) {
  if (tournament.type === "two_stage") return 4;
  if (tournament.format === "free_for_all") return 3;
  return 2;
}

function PairRounds({
  rounds,
  raceTo,
  drafts,
  setDrafts,
  onSave,
  onUndo,
  onStart,
  tables,
  onAssignTable,
  eyebrow,
  byePoints,
}: {
  rounds: BracketRound[];
  raceTo: number;
  drafts: Record<string, DraftScore>;
  setDrafts: Dispatch<SetStateAction<Record<string, DraftScore>>>;
  onSave: (match: BracketMatch, score1: number, score2: number) => void;
  onUndo: (match: BracketMatch) => void;
  onStart: (match: BracketMatch) => void;
  tables: VenueTableRow[];
  onAssignTable: (match: BracketMatch, tableId: number | null) => void;
  eyebrow?: string;
  byePoints?: number;
}) {
  return (
    <div className="space-y-5">
      {rounds.map((round) => {
        const playableMatches = round.matches.filter((match) => match.player1 && match.player2);
        const byeMatches = round.matches.filter((match) => Boolean(match.player1) !== Boolean(match.player2));
        const completed = playableMatches.filter((match) => match.completed).length;
        return (
          <section key={`${eyebrow ?? "round"}-${round.round}-${round.name}`} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">{eyebrow}</p> : null}
                <h3 className="mt-1 text-xl font-black text-white">{round.name}</h3>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400 ring-1 ring-white/10">
                {completed}/{playableMatches.length} played matches complete
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {playableMatches.map((match, matchIndex) => {
                const draft = drafts[match.id] ?? {
                  score1: match.score1?.toString() ?? "",
                  score2: match.score2?.toString() ?? "",
                };
                return (
                  <article key={match.id} className={`overflow-hidden rounded-2xl border bg-slate-950/65 ${match.completed ? "border-emerald-400/25" : "border-white/10"}`}>
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                      <span className="text-[0.64rem] font-black uppercase tracking-wider text-slate-400">
                        {match.tableNumber || `Match ${matchIndex + 1}`}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${match.completed ? "bg-emerald-400/10 text-emerald-300" : match.status === "live" ? "bg-rose-400/15 text-rose-300" : "bg-cyan-400/10 text-cyan-300"}`}>
                        {match.completed ? "Finished" : match.status === "live" ? "● Live" : `Race to ${raceTo}`}
                      </span>
                    </div>
                    {!match.completed ? (
                      <div className="border-b border-white/10 px-4 py-2.5">
                        <select value={match.tableId ?? ""} onChange={(event) => onAssignTable(match, event.target.value ? Number(event.target.value) : null)} aria-label={`Table for ${match.player1} versus ${match.player2}`} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                          <option value="">{tables.length ? "No table assigned" : "Add tables in Floor Control"}</option>
                          {tables.map((table) => {
                            const busy = Boolean(table.active_match_id && table.active_match_id !== match.id);
                            return <option key={table.id} value={table.id} disabled={busy}>{table.name}{busy ? ` · ${table.active_match_label || "Busy"}` : ""}</option>;
                          })}
                        </select>
                      </div>
                    ) : null}
                    {[match.player1, match.player2].map((player, index) => {
                      const key = index === 0 ? "score1" : "score2";
                      const isWinner = Boolean(player && match.completed && match.winner === player);
                      return (
                        <div key={`${match.id}-${index}`} className={`flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 ${isWinner ? "bg-emerald-400/10" : ""}`}>
                          <span className={`min-w-0 flex-1 truncate font-black ${isWinner ? "text-emerald-300" : "text-white"}`}>{player}</span>
                          <input
                            inputMode="numeric"
                            value={draft[key]}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [match.id]: { ...draft, [key]: event.target.value },
                            }))}
                            aria-label={`${player} score`}
                            className="h-10 w-16 rounded-xl border border-white/10 bg-slate-900 text-center font-black text-white outline-none focus:border-cyan-400/50"
                          />
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <MatchTimer startedAt={match.startedAt} endedAt={match.endedAt} />
                      <div className="flex justify-end gap-2">
                      {!match.completed && match.status !== "live" ? (
                        <button type="button" onClick={() => onStart(match)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">Start</button>
                      ) : null}
                      {match.completed ? (
                        <button type="button" onClick={() => onUndo(match)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white">Undo</button>
                      ) : null}
                      <button type="button" onClick={() => onSave(match, Number(draft.score1), Number(draft.score2))} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-cyan-300">
                        Save result
                      </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {byeMatches.map((match) => {
                const player = match.player1 ?? match.player2;
                return (
                  <article key={match.id} className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.64rem] font-black uppercase tracking-wider text-violet-300">{byePoints === undefined ? "Rest round" : "Automatic BYE"}</p>
                        <p className="mt-1 font-black text-white">{player}</p>
                      </div>
                      <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-xs font-black uppercase text-violet-200">No fixture this round</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      {byePoints === undefined
                        ? "No match or points recorded."
                        : `${player} receives one win and ${formatPoints(byePoints)} point${byePoints === 1 ? "" : "s"}; the BYE is tracked separately from played matches.`}
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

function FreeForAllEditor({
  competition,
  drafts,
  setDrafts,
  onSave,
  onUndo,
}: {
  competition: FreeForAllCompetition;
  drafts: Record<string, Record<string, string>>;
  setDrafts: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  onSave: (heatId: string, scores: Record<string, number>) => void;
  onUndo: (heatId: string) => void;
}) {
  const rounds = useMemo(() => {
    const map = new Map<number, FreeForAllCompetition["heats"]>();
    competition.heats.forEach((heat) => map.set(heat.round, [...(map.get(heat.round) ?? []), heat]));
    return Array.from(map.entries());
  }, [competition.heats]);

  return (
    <div className="space-y-5">
      {rounds.map(([round, heats]) => (
        <section key={round} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-black">Round {round}</h3>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400 ring-1 ring-white/10">{heats.filter((heat) => heat.completed).length}/{heats.length} heats complete</span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {heats.map((heat) => {
              const heatDraft = drafts[heat.id] ?? Object.fromEntries(heat.entries.map((entry) => [entry.player, entry.score?.toString() ?? ""]));
              return (
                <article key={heat.id} className={`overflow-hidden rounded-2xl border bg-slate-950/65 ${heat.completed ? "border-emerald-400/25" : "border-white/10"}`}>
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="font-black">{heat.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${heat.completed ? "bg-emerald-400/10 text-emerald-300" : "bg-cyan-400/10 text-cyan-300"}`}>{heat.completed ? "Finished" : "Open"}</span>
                  </div>
                  {heat.entries.map((entry) => (
                    <div key={entry.player} className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                      <span className="min-w-0 flex-1 truncate font-black text-white">{entry.player}</span>
                      {heat.completed ? <span className="text-xs font-bold text-slate-400">#{entry.placement} · {formatPoints(entry.points)} pts</span> : null}
                      <input
                        inputMode="numeric"
                        value={heatDraft[entry.player] ?? ""}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [heat.id]: { ...heatDraft, [entry.player]: event.target.value },
                        }))}
                        className="h-10 w-20 rounded-xl border border-white/10 bg-slate-900 text-center font-black text-white outline-none focus:border-cyan-400/50"
                        aria-label={`${entry.player} heat score`}
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 px-4 py-3">
                    {heat.completed ? <button type="button" onClick={() => onUndo(heat.id)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5">Undo</button> : null}
                    <button type="button" onClick={() => onSave(heat.id, Object.fromEntries(Object.entries(heatDraft).map(([player, value]) => [player, Number(value)])))} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950">
                      Save heat
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CompetitionManager({ tournament, onTournamentChange }: Props) {
  const competition = tournament.competition;
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftScore>>({});
  const [heatDrafts, setHeatDrafts] = useState<Record<string, Record<string, string>>>({});
  const [venueTables, setVenueTables] = useState<VenueTableRow[]>([]);
  const minPlayers = minimumPlayers(tournament);
  const tableScope = useMemo(() => ({ id: tournament.id, clubId: tournament.clubId ?? null, type: "tournament" as const }), [tournament.clubId, tournament.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const tables = await getEventVenueTables(tableScope);
        if (active) setVenueTables(tables);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load venue tables.");
      }
    };
    void load();
    const unsubscribe = subscribeToVenueTables(() => void load());
    return () => { active = false; unsubscribe(); };
  }, [tableScope]);

  function saveCompetition(next: TournamentCompetition | undefined) {
    const champion = next?.champion ?? null;
    const updated = updateTournament(tournament.id, {
      competition: next,
      bracket: undefined,
      status: champion ? "completed" : next ? "live" : "draft",
    });
    if (updated) onTournamentChange(updated);
  }

  function generate() {
    setMessage("");
    if (tournament.players.length < minPlayers) {
      setMessage(`Add at least ${minPlayers} players before generating this format.`);
      return;
    }
    try {
      saveCompetition(buildTournamentCompetition(tournament));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the competition.");
    }
  }

  function reset() {
    if (!window.confirm("Reset this competition and remove every result?")) return;
    setDrafts({});
    setHeatDrafts({});
    saveCompetition(undefined);
  }

  // 0.9F.5 strict shared race-to validation
  function validateScores(score1: number, score2: number) {
    if (!isValidRaceResult(score1, score2, tournament.raceTo)) {
      setMessage(
        `A completed race-to-${tournament.raceTo} result must have exactly one player on ${tournament.raceTo}, with the opponent below ${tournament.raceTo}.`,
      );
      return false;
    }

    setMessage("");
    return true;
  }

  function finishMutator(score1: number, score2: number) {
    return (target: BracketMatch) => {
      target.score1 = score1;
      target.score2 = score2;
      target.winner = score1 > score2 ? target.player1 : target.player2;
      target.completed = true;
      target.status = "finished";
      // Do not invent a start time when an organizer only records a result.
      // Duration statistics are shown only for matches explicitly started earlier.
      target.endedAt = new Date().toISOString();
    };
  }

  function undoMutator(target: BracketMatch) {
    target.score1 = null;
    target.score2 = null;
    target.winner = null;
    target.completed = false;
    target.status = "pending";
    target.startedAt = null;
    target.endedAt = null;
    target.scoreHistory = [];
    setDrafts((current) => ({ ...current, [target.id]: { score1: "", score2: "" } }));
  }

  function applyPairMatchUpdate(matchId: string, updater: (target: BracketMatch) => void, groupId?: string) {
    if (!competition) return;
    if (competition.type === "round_robin") {
      saveCompetition(updateRoundRobinMatch(competition, tournament.players, tournament.options, matchId, updater));
    } else if (competition.type === "swiss") {
      saveCompetition(updateSwissMatch(competition, tournament.players, tournament.options, matchId, updater));
    } else if (competition.type === "leaderboard") {
      saveCompetition(updateLeaderboardMatch(competition, tournament.players, tournament.options, matchId, updater));
    } else if (competition.type === "free_for_all") {
      saveCompetition(updateFreeForAllPlayoffMatch(competition, matchId, updater));
    } else if (competition.type === "two_stage") {
      saveCompetition(groupId
        ? updateTwoStageGroupMatch(competition, tournament.options, groupId, matchId, updater)
        : updateTwoStageFinalMatch(competition, matchId, updater));
    }
  }

  async function savePairMatch(match: BracketMatch, score1: number, score2: number, groupId?: string) {
    if (!competition || !validateScores(score1, score2)) return;
    if (match.tableId) {
      try {
        await releaseVenueTable({ tableId: match.tableId, scope: tableScope, matchId: match.id });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to release the table.");
      }
    }
    applyPairMatchUpdate(match.id, finishMutator(score1, score2), groupId);
  }

  function undoPairMatch(match: BracketMatch, groupId?: string) {
    applyPairMatchUpdate(match.id, undoMutator, groupId);
  }

  async function startPairMatch(match: BracketMatch, groupId?: string) {
    if (!competition) return;
    if (match.tableId) {
      try {
        await assignVenueTable({ tableId: match.tableId, scope: tableScope, matchId: match.id, matchLabel: `${match.player1} vs ${match.player2}`, status: "playing" });
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to start this match on the selected table.");
        return;
      }
    }
    void recordMatchStarted(tournament, match).catch(() => undefined);
    const updater = (target: BracketMatch) => {
      target.status = "live";
      target.startedAt = target.startedAt ?? new Date().toISOString();
      target.score1 = target.score1 ?? 0;
      target.score2 = target.score2 ?? 0;
      target.scoreHistory = target.scoreHistory ?? [];
    };
    applyPairMatchUpdate(match.id, updater, groupId);
  }

  async function assignPairMatchTable(match: BracketMatch, tableId: number | null, groupId?: string) {
    if (match.completed || match.tableId === tableId) return;
    try {
      if (match.tableId) await releaseVenueTable({ tableId: match.tableId, scope: tableScope, matchId: match.id });
      const table = venueTables.find((item) => item.id === tableId);
      if (table) {
        await assignVenueTable({ tableId: table.id, scope: tableScope, matchId: match.id, matchLabel: `${match.player1} vs ${match.player2}`, status: match.status === "live" ? "playing" : "reserved" });
      }
      applyPairMatchUpdate(match.id, (target) => {
        target.tableId = table?.id ?? null;
        target.tableNumber = table?.name ?? "";
      }, groupId);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign that table.");
    }
  }

  if (!competition) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-11 text-center">
        <div className="text-5xl">⚙️</div>
        <h2 className="mt-4 text-2xl font-black">Generate {tournament.type === "two_stage" ? "group stage and finals" : getFormatLabel(tournament.format)}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">CueBracket will create every round, pairing, heat and standings rule from the settings selected during setup.</p>
        {message ? <p className="mt-4 text-sm font-bold text-amber-300">{message}</p> : null}
        <button type="button" onClick={generate} disabled={tournament.players.length < minPlayers} className="mt-7 rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">Generate competition</button>
      </section>
    );
  }

  const champion = competition.champion;
  const pairTableProps = { tables: venueTables, onAssignTable: assignPairMatchTable };

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">Tournament engine</p>
          <h2 className="mt-2 text-2xl font-black">{competition.type === "two_stage" ? "Groups → Finals" : getFormatLabel(tournament.format)}</h2>
          <p className="mt-2 text-sm text-slate-400">Every saved result recalculates standings, qualification and the champion automatically.</p>
        </div>
        <button type="button" onClick={reset} className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10">Reset competition</button>
      </div>

      {message ? <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 ring-1 ring-amber-400/20">{message}</p> : null}
      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <summary className="cursor-pointer list-none font-black text-slate-200">
          <span className="flex items-center justify-between gap-3"><span>Tournament tools</span><span className="text-sm font-bold text-slate-400">Correct player names</span></span>
        </summary>
        <div className="mt-4 border-t border-white/10 pt-4">
          <PlayerNameEditor tournament={tournament} onTournamentChange={onTournamentChange} />
        </div>
      </details>
      {champion ? <ChampionCelebration champion={champion} description={getTournamentChampionDescription(tournament)} tournament={tournament} /> : null}

      {"championshipTiePlayers" in competition &&
      !competition.champion &&
      (competition.championshipTiePlayers?.length ?? 0) > 1 ? (
        <section className="space-y-5 rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.06] p-5 sm:p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Championship playoff</p>
            <h3 className="mt-2 text-xl font-black text-white">The tied leaders must decide it on the table</h3>
            <p className="mt-2 text-sm text-slate-400">CueBracket generated official playoff fixtures automatically. No player can become champion alphabetically or by array order.</p>
          </div>
          <StandingsTable rows={competition.playoffStandings} title="Playoff standings" rules={TABLE_RULES} />
          <PairRounds {...pairTableProps} rounds={competition.playoffRounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} onStart={startPairMatch} />
          {competition.playoffRounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2).every((match) => match.completed) ? (
            <button
              type="button"
              onClick={() => saveCompetition(generateChampionshipPlayoffRematch(
                competition,
                competition.type === "free_for_all" ? FREE_FOR_ALL_PLAYOFF_OPTIONS : tournament.options,
                competition.type === "free_for_all" ? "ffa" : competition.type === "leaderboard" ? "lb" : "sw",
              ))}
              className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950"
            >
              Generate playoff rematch
            </button>
          ) : null}
        </section>
      ) : null}

      {competition.type === "round_robin" ? (
        <>
          <StandingsTable rows={competition.standings} rules={TABLE_RULES} />
          <PairRounds {...pairTableProps} rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} onStart={startPairMatch} />
          {competition.playoffRounds.length ? (
            <section className="space-y-5 rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.05] p-5 sm:p-6">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Championship playoff</p>
                <p className="mt-2 text-sm text-slate-400">The regular table could not separate first place. The champion must be decided on the table.</p>
              </div>
              <StandingsTable rows={competition.playoffStandings} title="Playoff standings" rules={TABLE_RULES} />
              <PairRounds {...pairTableProps} rounds={competition.playoffRounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} onStart={startPairMatch} />
              {!competition.champion && competition.playoffRounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2).every((match) => match.completed) ? (
                <button type="button" onClick={() => saveCompetition(generateRoundRobinPlayoffRematch(competition, tournament.options))} className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Generate playoff rematch</button>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {competition.type === "swiss" ? (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <StandingsTable rows={competition.standings} showBuchholz showByes title={`Swiss standings · Round ${competition.currentRound}/${competition.totalRounds}`} rules={SWISS_RULES} />
            {canGenerateNextSwissRound(competition) ? (
              <button type="button" onClick={() => saveCompetition(generateNextSwissRound(competition, tournament.players, tournament.options))} className="rounded-2xl bg-violet-400 px-5 py-3 font-black text-slate-950">Generate next round →</button>
            ) : null}
          </div>
          <PairRounds {...pairTableProps} rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} onStart={startPairMatch} byePoints={tournament.options.pointsForWin} />
        </>
      ) : null}

      {competition.type === "leaderboard" ? (
        <>
          <StandingsTable rows={competition.standings} title="Live leaderboard" rules="Ranking: total points → head-to-head mini-table → frame difference → frames won → wins. Bonus and penalty adjustments are included in total points." />
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-400">Bonus and penalty points</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tournament.players.map((player) => (
                <label key={player} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm font-bold text-slate-300">
                  {player}
                  <input type="number" value={(competition as LeaderboardCompetition).adjustments[player] ?? 0} onChange={(event) => saveCompetition(setLeaderboardAdjustment(competition, tournament.players, tournament.options, player, Number(event.target.value) || 0))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                </label>
              ))}
            </div>
          </section>
          <PairRounds {...pairTableProps} rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} onStart={startPairMatch} />
        </>
      ) : null}

      {competition.type === "free_for_all" ? (
        <>
          <FreeForAllStandingsTable rows={competition.standings} rules={`Ranking: placement points → heat wins → podiums → best average finish → raw score. ${tieRuleLabel(competition.tieRule)}.`} />
          <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] px-5 py-4 text-sm text-slate-300">
            <span className="font-black text-cyan-300">Tie rule:</span> {tieRuleLabel(competition.tieRule)}. Heats are balanced to minimize repeat opponents across rounds.
          </section>
          <FreeForAllEditor
            competition={competition}
            drafts={heatDrafts}
            setDrafts={setHeatDrafts}
            onSave={(heatId, scores) => {
              if (Object.values(scores).some((score) => !Number.isFinite(score) || score < 0 || !Number.isInteger(score))) {
                setMessage("Every heat score must be a whole number of zero or more.");
                return;
              }
              try {
                setMessage("");
                saveCompetition(updateFreeForAllHeat(competition, tournament.players, heatId, scores));
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to save this heat.");
              }
            }}
            onUndo={(heatId) => saveCompetition(clearFreeForAllHeat(competition, tournament.players, heatId))}
          />
        </>
      ) : null}

      {competition.type === "two_stage" ? (
        <>
          <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.05] px-5 py-4 text-sm text-slate-300">
            Group qualifiers use crossover seeding: group winners face the lowest available qualifier from another group, avoiding same-group rematches in the opening final round whenever possible.
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            {competition.groups.map((group) => (
              <div key={group.id} className="space-y-4">
                <StandingsTable rows={group.standings} title={`${group.name} standings`} rules={TABLE_RULES} />
                {(group.qualificationTiePlayers?.length ?? 0) > 1 ? (
                  <section className="space-y-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-5">
                    <div>
                      <p className="font-black text-amber-200">Qualification playoff</p>
                      <p className="mt-2 text-sm text-slate-400">CueBracket generated fixtures for the tied qualification places. The required qualifier{group.qualificationTieSlots === 1 ? "" : "s"} will be selected from the playoff results.</p>
                    </div>
                    <StandingsTable rows={group.qualificationPlayoffStandings ?? []} title="Qualification playoff standings" rules={TABLE_RULES} />
                    <PairRounds tables={venueTables} onAssignTable={(match, tableId) => void assignPairMatchTable(match, tableId, group.id)} rounds={group.qualificationPlayoffRounds ?? []} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={(match, score1, score2) => void savePairMatch(match, score1, score2, group.id)} onUndo={(match) => undoPairMatch(match, group.id)} onStart={(match) => void startPairMatch(match, group.id)} eyebrow={`${group.name} playoff`} />
                    {!areTwoStageQualificationTiesResolved(competition) && (group.qualificationPlayoffRounds ?? []).flatMap((round) => round.matches).filter((match) => match.player1 && match.player2).every((match) => match.completed) ? (
                      <button type="button" onClick={() => saveCompetition(generateTwoStageQualificationPlayoffRematch(competition, tournament.options, group.id))} className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950">Generate qualification rematch</button>
                    ) : null}
                  </section>
                ) : null}
                <PairRounds tables={venueTables} onAssignTable={(match, tableId) => void assignPairMatchTable(match, tableId, group.id)} rounds={group.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={(match, score1, score2) => void savePairMatch(match, score1, score2, group.id)} onUndo={(match) => undoPairMatch(match, group.id)} onStart={(match) => void startPairMatch(match, group.id)} eyebrow={group.name} />
              </div>
            ))}
          </div>

          {!competition.finalBracket && areTwoStageGroupsComplete(competition) ? (
            <section className="rounded-[2rem] border border-violet-400/25 bg-violet-400/[0.07] p-7 text-center">
              <p className="text-4xl">🏁</p>
              <h3 className="mt-3 text-2xl font-black">Group stage complete</h3>
              <p className="mt-2 text-slate-400">{areTwoStageQualificationTiesResolved(competition) ? `The top ${competition.qualifiersPerGroup} from each group are ready for crossover-seeded ${competition.finalFormat === "double" ? "double-elimination" : "single-elimination"} finals.` : "Resolve every qualification tie above before generating the final stage."}</p>
              <button type="button" disabled={!areTwoStageQualificationTiesResolved(competition)} onClick={() => saveCompetition(generateTwoStageFinals(competition, tournament))} className="mt-5 rounded-2xl bg-violet-400 px-6 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Generate final stage</button>
            </section>
          ) : null}

          {competition.finalBracket ? (
            <section className="space-y-5">
              <div className="rounded-[2rem] border border-violet-400/20 bg-violet-400/[0.06] p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">Final stage</p>
                <h3 className="mt-2 text-2xl font-black">{competition.finalFormat === "double" ? "Double elimination" : "Single elimination"}</h3>
                <p className="mt-2 text-sm text-slate-400">Opening pairings use cross-group seeding. {competition.finalFormat === "double" && tournament.options.bracketResetEnabled ? "A bracket reset is automatically created if the losers-bracket winner beats the undefeated finalist in the first Grand Final." : ""}</p>
              </div>
              <PairRounds
                {...pairTableProps}
                rounds={getBracketRounds(competition.finalBracket).filter((round) => competition.finalBracket?.type !== "double" || round.name !== "Bracket Reset" || competition.finalBracket.resetRequired)}
                raceTo={tournament.raceTo}
                drafts={drafts}
                setDrafts={setDrafts}
                onSave={savePairMatch}
                onUndo={undoPairMatch}
                onStart={startPairMatch}
                eyebrow="Final stage"
              />
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
