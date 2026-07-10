"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createTournament, TournamentFormat, TournamentInput } from "@/lib/tournaments";

const sizes: TournamentInput["bracketSize"][] = [4, 8, 16, 32, 64, 128];

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single");
  const [raceTo, setRaceTo] = useState(5);
  const [bracketSize, setBracketSize] = useState<TournamentInput["bracketSize"]>(8);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 3) {
      setError("Tournament name must contain at least 3 characters.");
      return;
    }

    const tournament = createTournament({
      name,
      venue,
      format,
      raceTo,
      bracketSize,
    });

    router.push(`/tournaments/${tournament.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-400">New tournament</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Create the event.</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Set the basic tournament rules now. Player management and bracket generation come in the next phase.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-9">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-300">Tournament name *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Kasarani Friday Open"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-300">Venue</span>
              <input
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
                placeholder="e.g. Kasarani Pool House"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-bold text-slate-300">Format</span>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/60 p-1.5 ring-1 ring-white/10">
                {(["single", "double"] as TournamentFormat[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormat(value)}
                    className={`rounded-xl px-3 py-3 text-sm font-black transition ${
                      format === value ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {value === "single" ? "Single life" : "Double life"}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="mb-2 block text-sm font-bold text-slate-300">Race to</span>
              <input
                type="number"
                min={1}
                max={25}
                value={raceTo}
                onChange={(event) => setRaceTo(Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
              />
            </label>
          </div>

          <div>
            <span className="mb-3 block text-sm font-bold text-slate-300">Bracket size</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setBracketSize(size)}
                  className={`rounded-xl px-3 py-3 text-sm font-black transition ring-1 ${
                    bracketSize === size
                      ? "bg-cyan-400 text-slate-950 ring-cyan-300"
                      : "bg-slate-950/60 text-slate-400 ring-white/10 hover:text-white"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-300 ring-1 ring-rose-400/20">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950 hover:bg-cyan-300">
              Create Tournament
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
