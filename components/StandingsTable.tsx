import type { StandingRow } from "@/lib/tournaments";

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function StandingsTable({
  rows,
  showBuchholz = false,
  showByes = false,
  showDraws = false,
  title = "Standings",
  rules,
}: {
  rows: StandingRow[];
  showBuchholz?: boolean;
  showByes?: boolean;
  showDraws?: boolean;
  title?: string;
  rules?: string;
}) {
  const byesVisible = showByes || rows.some((row) => (row.byes ?? 0) > 0);
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-400">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/55 text-[0.66rem] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-3 py-3 text-center" title={byesVisible ? "Played matches; BYEs are excluded and shown separately" : "Played matches"}>P</th>
              <th className="px-3 py-3 text-center" title={byesVisible ? "On-table wins; BYEs are excluded and shown separately" : "Wins"}>W</th>
              {showDraws ? <th className="px-3 py-3 text-center">D</th> : null}
              <th className="px-3 py-3 text-center">L</th>
              {byesVisible ? <th className="px-3 py-3 text-center">BYE</th> : null}
              <th className="px-3 py-3 text-center">F</th>
              <th className="px-3 py-3 text-center">A</th>
              <th className="px-3 py-3 text-center">±</th>
              {showBuchholz ? <th className="px-3 py-3 text-center">BH</th> : null}
              <th className="px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player} className="border-t border-white/7 text-slate-300 first:border-t-0">
                <td className="px-4 py-3 font-black text-slate-500">{row.rank}</td>
                <td className="px-4 py-3 font-black text-white">{row.player}</td>
                <td className="px-3 py-3 text-center">{row.played}</td>
                <td className="px-3 py-3 text-center text-emerald-300">{row.won}</td>
                {showDraws ? <td className="px-3 py-3 text-center">{row.drawn}</td> : null}
                <td className="px-3 py-3 text-center text-rose-300">{row.lost}</td>
                {byesVisible ? <td className="px-3 py-3 text-center text-violet-300">{row.byes ?? 0}</td> : null}
                <td className="px-3 py-3 text-center">{row.framesFor}</td>
                <td className="px-3 py-3 text-center">{row.framesAgainst}</td>
                <td className={`px-3 py-3 text-center font-bold ${row.frameDifference > 0 ? "text-emerald-300" : row.frameDifference < 0 ? "text-rose-300" : "text-slate-400"}`}>
                  {row.frameDifference > 0 ? "+" : ""}{row.frameDifference}
                </td>
                {showBuchholz ? <td className="px-3 py-3 text-center">{formatNumber(row.buchholz ?? 0)}</td> : null}
                <td className="px-4 py-3 text-right text-lg font-black text-cyan-300">{formatNumber(row.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules ? <p className="border-t border-white/10 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6">{rules}</p> : null}
    </section>
  );
}

export function FreeForAllStandingsTable({
  rows,
  title = "Heat leaderboard",
  rules,
}: {
  rows: StandingRow[];
  title?: string;
  rules?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-400">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/55 text-[0.66rem] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-3 py-3 text-center">Heats</th>
              <th className="px-3 py-3 text-center">Wins</th>
              <th className="px-3 py-3 text-center">Podiums</th>
              <th className="px-3 py-3 text-center">Raw score</th>
              <th className="px-3 py-3 text-center">Avg finish</th>
              <th className="px-4 py-3 text-right">Placement pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player} className="border-t border-white/7 text-slate-300 first:border-t-0">
                <td className="px-4 py-3 font-black text-slate-500">{row.rank}</td>
                <td className="px-4 py-3 font-black text-white">{row.player}</td>
                <td className="px-3 py-3 text-center">{row.played}</td>
                <td className="px-3 py-3 text-center text-emerald-300">{row.heatWins ?? row.won}</td>
                <td className="px-3 py-3 text-center">{row.podiums ?? 0}</td>
                <td className="px-3 py-3 text-center">{formatNumber(row.rawScore ?? row.framesFor)}</td>
                <td className="px-3 py-3 text-center">{row.played ? formatNumber(row.averagePlacement ?? 0) : "—"}</td>
                <td className="px-4 py-3 text-right text-lg font-black text-cyan-300">{formatNumber(row.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules ? <p className="border-t border-white/10 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6">{rules}</p> : null}
    </section>
  );
}
