"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChampionCelebration } from "@/components/ChampionCelebration";
import { FreeForAllStandingsTable, StandingsTable } from "@/components/StandingsTable";
import { buildTournamentCompetition } from "@/lib/competition";
import { clearFreeForAllHeat, updateFreeForAllHeat } from "@/lib/competition/freeForAll";
import { setLeaderboardAdjustment, updateLeaderboardMatch } from "@/lib/competition/leaderboard";
import { updateRoundRobinMatch } from "@/lib/competition/roundRobin";
import { canGenerateNextSwissRound, generateNextSwissRound, updateSwissMatch } from "@/lib/competition/swiss";
import {
  areTwoStageGroupsComplete,
  generateTwoStageFinals,
  updateTwoStageFinalMatch,
  updateTwoStageGroupMatch,
} from "@/lib/competition/twoStage";
import {
  type BracketMatch,
  type BracketRound,
  type FreeForAllCompetition,
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

const TABLE_RULES = "Ranking: points → head-to-head mini-table → head-to-head frame difference → overall frame difference → frames won → wins.";
const SWISS_RULES = "Ranking: match points → Buchholz (opponents’ earned points) → frame difference → frames won. A BYE awards the configured win points but is tracked separately; it does not increase played matches (P) or on-table wins (W).";

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
  eyebrow,
  byePoints,
}: {
  rounds: BracketRound[];
  raceTo: number;
  drafts: Record<string, DraftScore>;
  setDrafts: Dispatch<SetStateAction<Record<string, DraftScore>>>;
  onSave: (match: BracketMatch, score1: number, score2: number) => void;
  onUndo: (match: BracketMatch) => void;
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
                {eyebrow ? <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-400">{eyebrow}</p> : null}
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
                      <span className="text-[0.64rem] font-black uppercase tracking-wider text-slate-500">
                        {match.tableNumber ? `Table ${match.tableNumber}` : `Match ${matchIndex + 1}`}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase ${match.completed ? "bg-emerald-400/10 text-emerald-300" : "bg-cyan-400/10 text-cyan-300"}`}>
                        {match.completed ? "Finished" : `Race to ${raceTo}`}
                      </span>
                    </div>
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
                    <div className="flex justify-end gap-2 px-4 py-3">
                      {match.completed ? (
                        <button type="button" onClick={() => onUndo(match)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white">Undo</button>
                      ) : null}
                      <button type="button" onClick={() => onSave(match, Number(draft.score1), Number(draft.score2))} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-cyan-300">
                        Save result
                      </button>
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
                        <p className="text-[0.64rem] font-black uppercase tracking-wider text-violet-300">Automatic BYE</p>
                        <p className="mt-1 font-black text-white">{player}</p>
                      </div>
                      <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[0.62rem] font-black uppercase text-violet-200">No opponent</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      {byePoints === undefined
                        ? `${player} advances automatically; no match is added to played-match statistics.`
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
    const map = new Map<number, typeof competition.heats>();
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
                    <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black uppercase ${heat.completed ? "bg-emerald-400/10 text-emerald-300" : "bg-cyan-400/10 text-cyan-300"}`}>{heat.completed ? "Finished" : "Open"}</span>
                  </div>
                  {heat.entries.map((entry) => (
                    <div key={entry.player} className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                      <span className="min-w-0 flex-1 truncate font-black text-white">{entry.player}</span>
                      {heat.completed ? <span className="text-xs font-bold text-slate-500">#{entry.placement} · {formatPoints(entry.points)} pts</span> : null}
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
  const minPlayers = minimumPlayers(tournament);

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

  function validateScores(score1: number, score2: number) {
    if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
      setMessage("Scores must be whole numbers of zero or more.");
      return false;
    }
    if (score1 === score2) {
      setMessage("Pool matches cannot finish as a draw.");
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

  function savePairMatch(match: BracketMatch, score1: number, score2: number, groupId?: string) {
    if (!competition || !validateScores(score1, score2)) return;
    const updater = finishMutator(score1, score2);
    if (competition.type === "round_robin") {
      saveCompetition(updateRoundRobinMatch(competition, tournament.players, tournament.options, match.id, updater));
    } else if (competition.type === "swiss") {
      saveCompetition(updateSwissMatch(competition, tournament.players, tournament.options, match.id, updater));
    } else if (competition.type === "leaderboard") {
      saveCompetition(updateLeaderboardMatch(competition, tournament.players, tournament.options, match.id, updater));
    } else if (competition.type === "two_stage") {
      saveCompetition(groupId
        ? updateTwoStageGroupMatch(competition, tournament.options, groupId, match.id, updater)
        : updateTwoStageFinalMatch(competition, match.id, updater));
    }
  }

  function undoPairMatch(match: BracketMatch, groupId?: string) {
    if (!competition) return;
    if (competition.type === "round_robin") {
      saveCompetition(updateRoundRobinMatch(competition, tournament.players, tournament.options, match.id, undoMutator));
    } else if (competition.type === "swiss") {
      saveCompetition(updateSwissMatch(competition, tournament.players, tournament.options, match.id, undoMutator));
    } else if (competition.type === "leaderboard") {
      saveCompetition(updateLeaderboardMatch(competition, tournament.players, tournament.options, match.id, undoMutator));
    } else if (competition.type === "two_stage") {
      saveCompetition(groupId
        ? updateTwoStageGroupMatch(competition, tournament.options, groupId, match.id, undoMutator)
        : updateTwoStageFinalMatch(competition, match.id, undoMutator));
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
      {champion ? <ChampionCelebration champion={champion} description={getTournamentChampionDescription(tournament)} /> : null}

      {competition.type === "round_robin" ? (
        <>
          <StandingsTable rows={competition.standings} rules={TABLE_RULES} />
          <PairRounds rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} />
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
          <PairRounds rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} byePoints={tournament.options.pointsForWin} />
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
          <PairRounds rounds={competition.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={savePairMatch} onUndo={undoPairMatch} />
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
                <PairRounds rounds={group.rounds} raceTo={tournament.raceTo} drafts={drafts} setDrafts={setDrafts} onSave={(match, score1, score2) => savePairMatch(match, score1, score2, group.id)} onUndo={(match) => undoPairMatch(match, group.id)} eyebrow={group.name} />
              </div>
            ))}
          </div>

          {!competition.finalBracket && areTwoStageGroupsComplete(competition) ? (
            <section className="rounded-[2rem] border border-violet-400/25 bg-violet-400/[0.07] p-7 text-center">
              <p className="text-4xl">🏁</p>
              <h3 className="mt-3 text-2xl font-black">Group stage complete</h3>
              <p className="mt-2 text-slate-400">The top {competition.qualifiersPerGroup} from each group are ready for crossover-seeded {competition.finalFormat === "double" ? "double-elimination" : "single-elimination"} finals.</p>
              <button type="button" onClick={() => saveCompetition(generateTwoStageFinals(competition, tournament))} className="mt-5 rounded-2xl bg-violet-400 px-6 py-3 font-black text-slate-950">Generate final stage</button>
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
                rounds={getBracketRounds(competition.finalBracket).filter((round) => competition.finalBracket?.type !== "double" || round.name !== "Bracket Reset" || competition.finalBracket.resetRequired)}
                raceTo={tournament.raceTo}
                drafts={drafts}
                setDrafts={setDrafts}
                onSave={savePairMatch}
                onUndo={undoPairMatch}
                eyebrow="Final stage"
              />
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
