"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assignVenueTable,
  getEventVenueTables,
  releaseVenueTable,
  subscribeToVenueTables,
  type VenueEventScope,
  type VenueTableRow,
} from "@/lib/cloud/tables";
import {
  generateLeagueFixtures,
  getPlayerName,
  League,
  resetFixtureResult,
  saveFixtureResult,
  setLeagueFixtureTable,
  validateLeagueResult,
} from "@/lib/leagues";

interface Props {
  league: League;
  admin?: boolean;
  onChange?: (league: League) => void;
}

export function LeagueFixtures({ league, admin = false, onChange }: Props) {
  const [round, setRound] = useState<number | "all">("all");
  const [tables, setTables] = useState<VenueTableRow[]>([]);
  const [tableMessage, setTableMessage] = useState("");
  const tableScope = useMemo<VenueEventScope>(() => ({ id: league.id, clubId: league.clubId, type: "league" }), [league.clubId, league.id]);
  const rounds = [...new Set(league.fixtures.map((fixture) => fixture.round))].sort((a, b) => a - b);

  const fixtures = useMemo(
    () => league.fixtures.filter((fixture) => round === "all" || fixture.round === round),
    [league.fixtures, round],
  );

  useEffect(() => {
    if (!admin) return;
    let active = true;
    const load = async () => {
      try {
        const rows = await getEventVenueTables(tableScope);
        if (active) setTables(rows);
      } catch (error) {
        if (active) setTableMessage(error instanceof Error ? error.message : "Unable to load venue tables.");
      }
    };
    void load();
    const unsubscribe = subscribeToVenueTables(() => void load());
    return () => { active = false; unsubscribe(); };
  }, [admin, tableScope]);

  function generate() {
    const updated = generateLeagueFixtures(league.id);
    if (updated && onChange) onChange(updated);
  }

  if (!league.fixtures.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <h2 className="text-2xl font-black text-white">Fixtures not generated</h2>
        <p className="mt-2 text-slate-400">Add {league.playoff.enabled ? `at least ${league.playoff.qualifierCount} players for the selected playoffs` : "at least two players"}, then generate the round-robin schedule.</p>
        {admin ? (
          <button
            onClick={generate}
            disabled={league.players.length < 2 || (league.playoff.enabled && league.players.length < league.playoff.qualifierCount)}
            className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-40"
          >
            Generate Fixtures
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Fixtures</p>
          <h2 className="mt-1 text-lg font-black text-white">Match schedule</h2>
        </div>
        <select
          value={round}
          onChange={(event) => setRound(event.target.value === "all" ? "all" : Number(event.target.value))}
          aria-label="Filter fixtures by round"
          className="min-h-11 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
        >
          <option value="all">All rounds</option>
          {rounds.map((value) => <option key={value} value={value}>Round {value}</option>)}
        </select>
      </div>

      {tableMessage ? <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-200">{tableMessage}</p> : null}
      <div className="mt-4 space-y-4">
        {rounds.filter((value) => round === "all" || value === round).map((value) => {
          const roundFixtures = fixtures.filter((fixture) => fixture.round === value);
          const played = roundFixtures.filter((fixture) => fixture.completed).length;
          return (
            <div key={value}>
              <div className="mb-1.5 flex items-center justify-between px-1 text-xs font-bold text-slate-400">
                <h3 className="uppercase tracking-wider">Round {value}</h3>
                <span>{played}/{roundFixtures.length} played</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/55">
                {roundFixtures.map((fixture) => (
                  <FixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    league={league}
                    admin={admin}
                    onChange={onChange}
                    tables={tables}
                    tableScope={tableScope}
                    onTableError={setTableMessage}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FixtureRow({
  fixture,
  league,
  admin,
  onChange,
  tables,
  tableScope,
  onTableError,
}: {
  fixture: League["fixtures"][number];
  league: League;
  admin: boolean;
  onChange?: (league: League) => void;
  tables: VenueTableRow[];
  tableScope: VenueEventScope;
  onTableError: (message: string) => void;
}) {
  const [homeScore, setHomeScore] = useState(fixture.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(fixture.awayScore ?? 0);
  const home = getPlayerName(league, fixture.homePlayerId);
  const away = getPlayerName(league, fixture.awayPlayerId);

  async function save() {
    const validation = validateLeagueResult(league.raceTo, homeScore, awayScore);
    if (validation) {
      onTableError(validation);
      return;
    }
    if (fixture.tableId) {
      try {
        await releaseVenueTable({ tableId: fixture.tableId, scope: tableScope, matchId: fixture.id });
      } catch (error) {
        onTableError(error instanceof Error ? error.message : "Unable to release the table.");
      }
    }
    const updated = saveFixtureResult(league.id, fixture.id, homeScore, awayScore);
    if (updated && onChange) onChange(updated);
  }

  async function assignTable(tableId: number | null) {
    if (fixture.completed || fixture.tableId === tableId) return;
    try {
      if (fixture.tableId) await releaseVenueTable({ tableId: fixture.tableId, scope: tableScope, matchId: fixture.id });
      const table = tables.find((item) => item.id === tableId);
      if (table) {
        await assignVenueTable({ tableId: table.id, scope: tableScope, matchId: fixture.id, matchLabel: `${home} vs ${away}`, status: "playing" });
      }
      const updated = setLeagueFixtureTable(league.id, fixture.id, table?.id ?? null, table?.name ?? "");
      if (updated && onChange) onChange(updated);
      onTableError("");
    } catch (error) {
      onTableError(error instanceof Error ? error.message : "Unable to assign that table.");
    }
  }

  function reset() {
    const updated = resetFixtureResult(league.id, fixture.id);
    if (updated && onChange) onChange(updated);
  }

  const matchup = (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2 text-base sm:text-sm">
      <span title={home} className={`truncate text-right font-bold ${fixture.completed && (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0) ? "text-cyan-200" : "text-white"}`}>{home}</span>
      <span className={`text-center font-black tabular-nums ${fixture.completed ? "text-emerald-300" : "text-slate-500"}`}>
        {fixture.completed ? `${fixture.homeScore}–${fixture.awayScore}` : "vs"}
      </span>
      <span title={away} className={`truncate font-bold ${fixture.completed && (fixture.awayScore ?? 0) > (fixture.homeScore ?? 0) ? "text-cyan-200" : "text-white"}`}>{away}</span>
      <span className="sr-only">{fixture.completed ? "Played" : "Pending"}</span>
    </div>
  );

  if (!admin) {
    return (
      <div className="border-t border-white/5 px-3 py-2.5 first:border-t-0">
        <div className="flex min-h-7 items-center">{matchup}</div>
        {fixture.tableName ? <p className="mt-0.5 truncate text-center text-xs text-cyan-300">{fixture.tableName}</p> : null}
      </div>
    );
  }

  return (
    <details className="group border-t border-white/5 first:border-t-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">
        {matchup}
        <span aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-90">›</span>
        <span className="sr-only">Edit match</span>
      </summary>
      <div className="border-t border-white/5 bg-slate-900/40 p-3">
        <p className="mb-2 break-words text-xs font-bold text-slate-300">{home} vs {away} · Race to {league.raceTo}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <input type="number" aria-label={`Score for ${home}`} min={0} max={league.raceTo} value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value))} className="min-h-11 w-14 rounded-lg border border-white/10 bg-slate-950 px-2 text-center font-black text-white" />
          <span className="text-slate-400">–</span>
          <input type="number" aria-label={`Score for ${away}`} min={0} max={league.raceTo} value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value))} className="min-h-11 w-14 rounded-lg border border-white/10 bg-slate-950 px-2 text-center font-black text-white" />
          <button onClick={() => void save()} className="min-h-11 rounded-lg bg-cyan-400 px-3 text-xs font-black text-slate-950">Save result</button>
          {fixture.completed ? <button onClick={reset} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-300">Reset</button> : null}
        </div>
        <label className="mt-3 block text-xs font-bold text-slate-400">
          Venue table
          <select value={fixture.tableId ?? ""} onChange={(event) => void assignTable(event.target.value ? Number(event.target.value) : null)} disabled={fixture.completed} className="mt-1 block min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white disabled:opacity-60">
            <option value="">{tables.length ? "No table" : "Add tables in Floor Control"}</option>
            {tables.map((table) => {
              const busy = Boolean(table.active_match_id && table.active_match_id !== fixture.id);
              return <option key={table.id} value={table.id} disabled={busy}>{table.name}{busy ? ` · ${table.active_match_label || "Busy"}` : ""}</option>;
            })}
          </select>
        </label>
      </div>
    </details>
  );
}
