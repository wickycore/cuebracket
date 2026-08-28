"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createLeague, LeagueFormat, LeagueInput } from "@/lib/leagues";
import { getManagedClubs } from "@/lib/cloud/clubs";
import type { ClubRow } from "@/lib/clubs";

export default function NewLeaguePage() {
  const router = useRouter();
  const [form, setForm] = useState<LeagueInput>({
    name: "",
    season: "Season 1",
    venue: "",
    gameType: "8-ball",
    raceTo: 5,
    format: "single-round-robin",
    winPoints: 3,
    lossPoints: 0,
    startDate: "",
    endDate: "",
    clubId: null,
    playoffEnabled: true,
    playoffQualifierCount: 4,
  });
  const [managedClubs, setManagedClubs] = useState<ClubRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getManagedClubs().then((clubs) => { if (active) setManagedClubs(clubs); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 3) {
      setError("League name must contain at least 3 characters.");
      return;
    }
    const league = createLeague(form);
    router.push(`/leagues/${league.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">New league</p>
        <h1 className="mt-3 text-4xl font-black">Create a league.</h1>
        <p className="mt-3 text-slate-400">Set league rules, add participants, generate fixtures and track the table.</p>

        <form onSubmit={submit} className="mt-8 grid gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:grid-cols-2">
          <Field label="League name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kasarani Premier League" className={input} />
          </Field>
          <Field label="Season">
            <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="Season 1" className={input} />
          </Field>
          <Field label="Venue">
            <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Pool club or venue" className={input} />
          </Field>
          <Field label="Hosted by">
            <select value={form.clubId ?? ""} onChange={(e) => setForm({ ...form, clubId: e.target.value || null })} className={input}>
              <option value="">Independent league</option>
              {managedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
            {!managedClubs.length ? <span className="mt-2 block text-xs text-slate-500"><Link href="/clubs/new" className="font-black text-cyan-300">Create a club</Link> to run club seasons and import its registered roster.</span> : null}
          </Field>
          <Field label="Game type">
            <select value={form.gameType} onChange={(e) => setForm({ ...form, gameType: e.target.value as LeagueInput["gameType"] })} className={input}>
              <option value="8-ball">8 Ball</option>
              <option value="9-ball">9 Ball</option>
              <option value="10-ball">10 Ball</option>
              <option value="blackball">Blackball</option>
              <option value="snooker">Snooker</option>
            </select>
          </Field>
          <Field label="Schedule format">
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as LeagueFormat })} className={input}>
              <option value="single-round-robin">Single round robin</option>
              <option value="home-and-away">Home and away</option>
            </select>
          </Field>
          <Field label="Race to">
            <select value={form.raceTo} onChange={(e) => setForm({ ...form, raceTo: Number(e.target.value) })} className={input}>
              {[3, 5, 7, 9, 11].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Points for win">
            <input type="number" min={0} value={form.winPoints} onChange={(e) => setForm({ ...form, winPoints: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Points for loss">
            <input type="number" min={0} value={form.lossPoints} onChange={(e) => setForm({ ...form, lossPoints: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Start date">
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
          </Field>
          <Field label="End date">
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={input} />
          </Field>

          <div className="md:col-span-2 rounded-2xl border border-violet-400/20 bg-violet-400/[0.055] p-5">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={form.playoffEnabled} onChange={(e) => setForm({ ...form, playoffEnabled: e.target.checked })} className="mt-1 h-5 w-5 accent-violet-300" />
              <span><span className="block font-black text-white">Finish with league playoffs</span><span className="mt-1 block text-sm leading-6 text-slate-400">Qualifiers are seeded from the final table into a single-elimination championship bracket.</span></span>
            </label>
            {form.playoffEnabled ? (
              <label className="mt-4 block max-w-xs text-sm font-bold text-slate-300">
                Playoff field
                <select value={form.playoffQualifierCount} onChange={(e) => setForm({ ...form, playoffQualifierCount: Number(e.target.value) as LeagueInput["playoffQualifierCount"] })} className={`${input} mt-2`}>
                  <option value={2}>Top 2 · Final</option>
                  <option value={4}>Top 4 · Semi-finals</option>
                  <option value={8}>Top 8 · Quarter-finals</option>
                </select>
              </label>
            ) : null}
          </div>

          {error ? <p className="md:col-span-2 rounded-xl bg-rose-400/10 p-4 font-bold text-rose-300">{error}</p> : null}

          <div className="md:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300">Cancel</button>
            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Create League</button>
          </div>
        </form>
      </div>
    </main>
  );
}

const input = "w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-bold text-slate-300">{label}<div className="mt-2">{children}</div></label>;
}
