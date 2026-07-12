"use client";

import { useMemo, useState } from "react";
import {
  generateLeagueFixtures,
  getPlayerName,
  League,
  resetFixtureResult,
  saveFixtureResult,
} from "@/lib/leagues";

interface Props {
  league: League;
  admin?: boolean;
  onChange?: (league: League) => void;
}

export function LeagueFixtures({ league, admin = false, onChange }: Props) {
  const [round, setRound] = useState<number | "all">("all");
  const rounds = [...new Set(league.fixtures.map((fixture) => fixture.round))].sort((a, b) => a - b);

  const fixtures = useMemo(
    () => league.fixtures.filter((fixture) => round === "all" || fixture.round === round),
    [league.fixtures, round],
  );

  function generate() {
    const updated = generateLeagueFixtures(league.id);
    if (updated && onChange) onChange(updated);
  }

  if (!league.fixtures.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <h2 className="text-2xl font-black text-white">Fixtures not generated</h2>
        <p className="mt-2 text-slate-400">Add at least two players, then generate the round-robin schedule.</p>
        {admin ? (
          <button
            onClick={generate}
            disabled={league.players.length < 2}
            className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-40"
          >
            Generate Fixtures
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Fixtures</p>
          <h2 className="mt-2 text-2xl font-black text-white">Match schedule</h2>
        </div>
        <select
          value={round}
          onChange={(event) => setRound(event.target.value === "all" ? "all" : Number(event.target.value))}
          className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-bold text-white"
        >
          <option value="all">All rounds</option>
          {rounds.map((value) => <option key={value} value={value}>Round {value}</option>)}
        </select>
      </div>

      <div className="mt-5 space-y-3">
        {fixtures.map((fixture) => (
          <FixtureRow
            key={fixture.id}
            fixture={fixture}
            league={league}
            admin={admin}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function FixtureRow({
  fixture,
  league,
  admin,
  onChange,
}: {
  fixture: League["fixtures"][number];
  league: League;
  admin: boolean;
  onChange?: (league: League) => void;
}) {
  const [homeScore, setHomeScore] = useState(fixture.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(fixture.awayScore ?? 0);
  const home = getPlayerName(league, fixture.homePlayerId);
  const away = getPlayerName(league, fixture.awayPlayerId);

  function save() {
    if (homeScore === awayScore) {
      window.alert("Pool league matches cannot finish level. Enter a winner.");
      return;
    }
    const updated = saveFixtureResult(league.id, fixture.id, homeScore, awayScore);
    if (updated && onChange) onChange(updated);
  }

  function reset() {
    const updated = resetFixtureResult(league.id, fixture.id);
    if (updated && onChange) onChange(updated);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Round {fixture.round}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${fixture.completed ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
          {fixture.completed ? "Played" : "Pending"}
        </span>
      </div>

      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="text-right font-black text-white">{home}</div>
        {admin ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={homeScore}
              onChange={(event) => setHomeScore(Number(event.target.value))}
              className="w-16 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center font-black text-white"
            />
            <span className="text-slate-500">–</span>
            <input
              type="number"
              min={0}
              value={awayScore}
              onChange={(event) => setAwayScore(Number(event.target.value))}
              className="w-16 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center font-black text-white"
            />
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-xl font-black text-white">
            {fixture.completed ? `${fixture.homeScore} – ${fixture.awayScore}` : "vs"}
          </div>
        )}
        <div className="font-black text-white">{away}</div>
      </div>

      {admin ? (
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={save} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">
            Save result
          </button>
          {fixture.completed ? (
            <button onClick={reset} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-slate-300">
              Reset
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
