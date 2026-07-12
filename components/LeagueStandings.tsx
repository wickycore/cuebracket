"use client";

import { getLeagueStandings, League } from "@/lib/leagues";

export function LeagueStandings({ league }: { league: League }) {
  const rows = getLeagueStandings(league);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
      <div className="p-6">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Standings</p>
        <h2 className="mt-2 text-2xl font-black text-white">League table</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">#</th>
              <th className="px-5 py-3">Player</th>
              <th className="px-5 py-3">P</th>
              <th className="px-5 py-3">W</th>
              <th className="px-5 py-3">L</th>
              <th className="px-5 py-3">FF</th>
              <th className="px-5 py-3">FA</th>
              <th className="px-5 py-3">Diff</th>
              <th className="px-5 py-3">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.playerId} className="border-t border-white/5 text-slate-300">
                <td className="px-5 py-4 font-black text-cyan-300">{index + 1}</td>
                <td className="px-5 py-4 font-black text-white">{row.playerName}</td>
                <td className="px-5 py-4">{row.played}</td>
                <td className="px-5 py-4">{row.won}</td>
                <td className="px-5 py-4">{row.lost}</td>
                <td className="px-5 py-4">{row.framesFor}</td>
                <td className="px-5 py-4">{row.framesAgainst}</td>
                <td className="px-5 py-4">{row.difference > 0 ? `+${row.difference}` : row.difference}</td>
                <td className="px-5 py-4 text-lg font-black text-white">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
