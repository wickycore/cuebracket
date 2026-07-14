"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import {
  createTournament,
  DEFAULT_TOURNAMENT_OPTIONS,
  FinalStageFormat,
  TournamentFormat,
  TournamentOptions,
  TournamentType,
} from "@/lib/tournaments";

const formats: Array<{
  value: TournamentFormat;
  name: string;
  icon: string;
  description: string;
  bestFor: string;
}> = [
  { value: "single", name: "Single Elimination", icon: "⚡", description: "One loss eliminates a player. Fast, clean and exciting.", bestFor: "Quick knockout events" },
  { value: "double", name: "Double Elimination", icon: "♻️", description: "Players get a second life through the losers bracket.", bestFor: "Serious weekend events" },
  { value: "round_robin", name: "Round Robin", icon: "🔄", description: "Every player meets every other player and earns table points.", bestFor: "Fair club competitions" },
  { value: "swiss", name: "Swiss System", icon: "♟️", description: "Players with similar records are paired without repeated opponents.", bestFor: "Large fields, fewer rounds" },
  { value: "free_for_all", name: "Free For All", icon: "🔥", description: "Multi-player heats award placement points across several rounds.", bestFor: "Creative club events" },
  { value: "leaderboard", name: "Leaderboard", icon: "📈", description: "A season-style schedule with wins, frame difference and bonus points.", bestFor: "Ongoing rankings" },
];

const eliminationCapacities = [4, 8, 16, 32, 64, 128];
const flexibleCapacities = [4, 6, 8, 10, 12, 16, 24, 32, 48, 64, 128];

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [type, setType] = useState<TournamentType>("single_stage");
  const [format, setFormat] = useState<TournamentFormat>("single");
  const [raceTo, setRaceTo] = useState(5);
  const [bracketSize, setBracketSize] = useState(8);
  const [options, setOptions] = useState<TournamentOptions>(DEFAULT_TOURNAMENT_OPTIONS);
  const [error, setError] = useState("");

  const selectedFormat = formats.find((item) => item.value === format)!;
  const capacities = useMemo(
    () => type === "single_stage" && (format === "single" || format === "double")
      ? eliminationCapacities
      : flexibleCapacities,
    [format, type],
  );

  function updateOption<K extends keyof TournamentOptions>(key: K, value: TournamentOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function chooseType(nextType: TournamentType) {
    setType(nextType);
    if (nextType === "two_stage") {
      if (![8, 10, 12, 16, 24, 32].includes(bracketSize)) setBracketSize(8);
    } else if ((format === "single" || format === "double") && !eliminationCapacities.includes(bracketSize)) {
      setBracketSize(8);
    }
  }

  function chooseFormat(nextFormat: TournamentFormat) {
    setFormat(nextFormat);
    if ((nextFormat === "single" || nextFormat === "double") && !eliminationCapacities.includes(bracketSize)) {
      setBracketSize(8);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 3) {
      setError("Tournament name must contain at least 3 characters.");
      return;
    }
    if (!Number.isInteger(raceTo) || raceTo < 1 || raceTo > 25) {
      setError("Race target must be between 1 and 25.");
      return;
    }
    if (type === "two_stage") {
      if (options.groupCount < 2 || options.groupCount > Math.floor(bracketSize / 2)) {
        setError("Two-stage events need at least two groups with room for two players in each group.");
        return;
      }
      if (options.qualifiersPerGroup < 1) {
        setError("At least one player must qualify from each group.");
        return;
      }
      const smallestGroup = Math.floor(bracketSize / options.groupCount);
      if (options.qualifiersPerGroup > smallestGroup) {
        setError(`Only ${smallestGroup} player${smallestGroup === 1 ? "" : "s"} fit in the smallest group. Reduce the qualifiers or number of groups.`);
        return;
      }
    }

    const tournament = createTournament({
      name,
      venue,
      type,
      format,
      raceTo,
      bracketSize,
      options,
    });

    router.push(`/tournaments/${tournament.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-400">Tournament architect</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Choose the competition. CueBracket builds the engine.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-400">
            Every format below has real scheduling, scoring, progression and standings logic—not just a label in a dropdown.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-lg font-black text-slate-950">1</span>
              <div>
                <h2 className="text-2xl font-black">Event details</h2>
                <p className="mt-1 text-sm text-slate-400">Name the competition and set the match race.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-300">Tournament name *</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kasarani Sunday Masters" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-300">Venue</span>
                <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="e.g. Kasarani Pool House" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-300">{type === "single_stage" && format === "free_for_all" ? "Score cap" : "Race to"}</span>
                <input type="number" min={1} max={25} value={raceTo} onChange={(event) => setRaceTo(Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none focus:border-cyan-400/50" />
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-lg font-black text-slate-950">2</span>
              <div>
                <h2 className="text-2xl font-black">Tournament type</h2>
                <p className="mt-1 text-sm text-slate-400">Use one competition stage or qualify players into a final stage.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {([
                ["single_stage", "Single-stage tournament", "One format from opening match to champion.", "🎯"],
                ["two_stage", "Two-stage tournament", "Round-robin groups followed by knockout finals.", "🏆"],
              ] as const).map(([value, title, description, icon]) => (
                <button key={value} type="button" onClick={() => chooseType(value)} className={`rounded-3xl border p-5 text-left transition ${type === value ? "border-cyan-400/50 bg-cyan-400/10 ring-4 ring-cyan-400/10" : "border-white/10 bg-slate-950/40 hover:border-white/20"}`}>
                  <span className="text-3xl">{icon}</span>
                  <p className="mt-3 text-lg font-black">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
                </button>
              ))}
            </div>
          </section>

          {type === "single_stage" ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-lg font-black text-slate-950">3</span>
                <div>
                  <h2 className="text-2xl font-black">Competition format</h2>
                  <p className="mt-1 text-sm text-slate-400">Select how players meet and how the champion is decided.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {formats.map((item) => (
                  <button key={item.value} type="button" onClick={() => chooseFormat(item.value)} className={`group rounded-3xl border p-5 text-left transition ${format === item.value ? "border-cyan-400/50 bg-cyan-400/10 ring-4 ring-cyan-400/10" : "border-white/10 bg-slate-950/40 hover:-translate-y-0.5 hover:border-white/20"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-3xl">{item.icon}</span>
                      {format === item.value ? <span className="rounded-full bg-cyan-400 px-2.5 py-1 text-[0.62rem] font-black uppercase text-slate-950">Selected</span> : null}
                    </div>
                    <p className="mt-4 text-lg font-black">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                    <p className="mt-4 text-xs font-bold text-cyan-300">Best for: {item.bestFor}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-lg font-black text-slate-950">{type === "single_stage" ? 4 : 3}</span>
              <div>
                <h2 className="text-2xl font-black">Format rules</h2>
                <p className="mt-1 text-sm text-slate-400">Only settings relevant to your chosen engine appear here.</p>
              </div>
            </div>

            {type === "single_stage" && (format === "single" || format === "double") ? (
              <div className="mt-6 rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.05] p-5">
                <p className="font-black">{selectedFormat.name}</p>
                <p className="mt-1 text-sm text-slate-400">BYEs are distributed automatically and every winner advances through the correct path.</p>
                {format === "double" ? (
                  <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-300">
                    <input type="checkbox" checked={options.bracketResetEnabled} onChange={(event) => updateOption("bracketResetEnabled", event.target.checked)} className="h-5 w-5 accent-cyan-400" />
                    Enable bracket-reset final when the losers-bracket champion wins the first Grand Final
                  </label>
                ) : null}
              </div>
            ) : null}

            {type === "single_stage" && format === "round_robin" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Meetings per opponent</span><select value={options.roundRobinLegs} onChange={(event) => updateOption("roundRobinLegs", Number(event.target.value) as 1 | 2)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5"><option value={1}>Once</option><option value={2}>Home and away / twice</option></select></label>
              </div>
            ) : null}

            {type === "single_stage" && format === "swiss" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Swiss rounds</span><input type="number" min={2} max={12} value={options.swissRounds} onChange={(event) => updateOption("swissRounds", Math.max(2, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-400">Pairings follow current points, avoid repeat opponents where possible and award fair rotating BYEs.</div>
              </div>
            ) : null}

            {type === "single_stage" && format === "free_for_all" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Number of heat rounds</span><input type="number" min={1} max={10} value={options.freeForAllRounds} onChange={(event) => updateOption("freeForAllRounds", Math.max(1, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Players per heat</span><input type="number" min={2} max={12} value={options.freeForAllHeatSize} onChange={(event) => updateOption("freeForAllHeatSize", Math.max(2, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Tied heat scores</span><select value={options.freeForAllTieRule} onChange={(event) => updateOption("freeForAllTieRule", event.target.value as TournamentOptions["freeForAllTieRule"])} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5"><option value="split_points">Split occupied placement points (recommended)</option><option value="full_points">Give every tied player full points</option><option value="tiebreak_required">Require a tiebreak score</option></select></label>
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-slate-400 sm:col-span-2 lg:col-span-3">CueBracket balances each heat round to minimize repeated opponents. Free For All standings use placement points, heat wins, podiums, average finish and raw score—not head-to-head wins and losses.</div>
              </div>
            ) : null}

            {type === "single_stage" && format === "leaderboard" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Schedule cycles</span><input type="number" min={1} max={6} value={options.leaderboardCycles} onChange={(event) => updateOption("leaderboardCycles", Math.max(1, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-400">Bonus and penalty points remain editable during the competition for disciplinary or club-award rules.</div>
              </div>
            ) : null}

            {type === "two_stage" ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Groups</span><input type="number" min={2} max={8} value={options.groupCount} onChange={(event) => updateOption("groupCount", Math.max(2, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Qualify per group</span><input type="number" min={1} max={8} value={options.qualifiersPerGroup} onChange={(event) => updateOption("qualifiersPerGroup", Math.max(1, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Group meetings</span><select value={options.roundRobinLegs} onChange={(event) => updateOption("roundRobinLegs", Number(event.target.value) as 1 | 2)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5"><option value={1}>Once</option><option value={2}>Twice</option></select></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Final stage</span><select value={options.finalStageFormat} onChange={(event) => updateOption("finalStageFormat", event.target.value as FinalStageFormat)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5"><option value="single">Single elimination</option><option value="double">Double elimination</option></select></label>
                <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.05] p-4 text-sm leading-6 text-slate-400 sm:col-span-2 lg:col-span-4">Finals use crossover seeding: group winners face lower qualifiers from another group. Immediate group rematches are avoided whenever possible.</div>
                {options.finalStageFormat === "double" ? <label className="flex items-center gap-3 text-sm font-bold text-slate-300 sm:col-span-2 lg:col-span-4"><input type="checkbox" checked={options.bracketResetEnabled} onChange={(event) => updateOption("bracketResetEnabled", event.target.checked)} className="h-5 w-5 accent-cyan-400" />Enable a bracket-reset match if the losers-bracket winner wins the first Grand Final</label> : null}
              </div>
            ) : null}

            {(type === "two_stage" || ["round_robin", "swiss", "leaderboard"].includes(format)) ? (
              <div className="mt-6 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Points for win</span><input type="number" min={0} value={options.pointsForWin} onChange={(event) => updateOption("pointsForWin", Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Points for draw</span><input type="number" min={0} value={options.pointsForDraw} onChange={(event) => updateOption("pointsForDraw", Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-300">Points for loss</span><input type="number" min={0} value={options.pointsForLoss} onChange={(event) => updateOption("pointsForLoss", Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5" /></label>
              </div>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-lg font-black text-slate-950">{type === "single_stage" ? 5 : 4}</span>
              <div>
                <h2 className="text-2xl font-black">Player capacity</h2>
                <p className="mt-1 text-sm text-slate-400">You can run with fewer players; unused knockout slots become balanced BYEs.</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {capacities.map((size) => (
                <button key={size} type="button" onClick={() => setBracketSize(size)} className={`rounded-xl px-3 py-3 text-sm font-black transition ring-1 ${bracketSize === size ? "bg-cyan-400 text-slate-950 ring-cyan-300" : "bg-slate-950/60 text-slate-400 ring-white/10 hover:text-white"}`}>{size}</button>
              ))}
            </div>
          </section>

          {error ? <p className="rounded-2xl bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-300 ring-1 ring-rose-400/20">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">{type === "two_stage" ? "Round-robin groups → knockout finals" : selectedFormat.name}</p>
              <p className="mt-1 text-sm text-slate-400">Capacity {bracketSize} · {type === "single_stage" && format === "free_for_all" ? "Score cap" : "Race to"} {raceTo}</p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => router.back()} className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300 hover:bg-white/5">Cancel</button>
              <button type="submit" className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950 hover:bg-cyan-300">Create tournament →</button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
