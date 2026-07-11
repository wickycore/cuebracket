"use client";

const confetti = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 9) * 0.12}s`,
  duration: `${2.2 + (index % 5) * 0.35}s`,
  rotate: `${(index * 47) % 360}deg`,
}));

export function ChampionCelebration({ champion }: { champion: string }) {
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-amber-300/30 bg-gradient-to-br from-amber-300/20 via-violet-400/10 to-cyan-300/10 p-8 text-center shadow-[0_0_80px_rgba(251,191,36,.14)]">
      <style>{`
        @keyframes cue-confetti-fall {
          0% { transform: translate3d(0,-30px,0) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(15px,360px,0) rotate(620deg); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confetti.map((piece, index) => (
          <span
            key={index}
            className={`absolute top-0 h-2.5 w-1.5 rounded-sm ${index % 3 === 0 ? "bg-cyan-300" : index % 3 === 1 ? "bg-amber-300" : "bg-violet-400"}`}
            style={{
              left: piece.left,
              animation: `cue-confetti-fall ${piece.duration} linear ${piece.delay} infinite`,
              transform: `rotate(${piece.rotate})`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10">
        <div className="text-6xl drop-shadow-[0_0_20px_rgba(251,191,36,.55)]">🏆</div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-amber-300">Tournament Champion</p>
        <h3 className="mt-3 text-4xl font-black text-white sm:text-5xl">{champion}</h3>
        <p className="mt-3 text-sm font-semibold text-slate-300">The double-elimination bracket is complete.</p>
      </div>
    </div>
  );
}
