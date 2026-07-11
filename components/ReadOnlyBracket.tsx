"use client";

import { Tournament } from "@/lib/tournaments";

export function ReadOnlyBracket({ tournament }: { tournament: Tournament }) {
  if (!tournament.bracket) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
        <p className="text-4xl">🧩</p>
        <h2 className="mt-3 text-2xl font-black">Bracket not generated yet</h2>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-[2rem] border border-white/10 bg-slate-900/55 p-5 sm:p-7">
      <div className="flex min-w-max items-start gap-14 pb-4">
        {tournament.bracket.rounds.map((round, roundIndex) => (
          <div key={round.round} className="w-72 shrink-0">
            <p className="mb-5 text-sm font-black uppercase tracking-[0.18em] text-slate-400">{round.name}</p>
            <div className="flex flex-col" style={{ gap: `${24 + (Math.pow(2, roundIndex) - 1) * 116}px`, paddingTop: `${(Math.pow(2, roundIndex) - 1) * 58}px` }}>
              {round.matches.map((match) => (
                <article key={match.id} className={`relative rounded-2xl border bg-slate-950/80 shadow-xl ${match.completed ? "border-emerald-400/35" : match.status === "live" ? "border-cyan-400/45" : "border-white/10"}`}>
                  {roundIndex < tournament.bracket!.rounds.length - 1 ? <span className="absolute left-full top-1/2 h-px w-14 bg-cyan-400/35" /> : null}
                  {[match.player1, match.player2].map((player, index) => {
                    const winner = Boolean(match.completed && player && match.winner === player);
                    const score = index === 0 ? match.score1 : match.score2;
                    return (
                      <div key={index} className={`flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 ${winner ? "bg-emerald-400/10" : ""}`}>
                        <span className={`min-w-0 flex-1 truncate font-bold ${winner ? "text-emerald-300" : player ? "text-white" : "text-slate-600"}`}>{player ?? "BYE"}</span>
                        <span className="text-lg font-black tabular-nums text-cyan-300">{score ?? "—"}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-500">
                    <span>{match.tableNumber || `Race to ${tournament.raceTo}`}</span>
                    <span className={match.status === "live" ? "text-emerald-300" : ""}>{match.status === "live" ? "● LIVE" : match.completed ? "Finished" : "Pending"}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
