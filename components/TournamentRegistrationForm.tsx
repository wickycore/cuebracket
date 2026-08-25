"use client";

import { useState, type FormEvent } from "react";

import type { EventRegistrationRow, RegistrationSettingsRow } from "@/lib/cloud/registrations";
import { validateRegistrationName } from "@/lib/registration";
import { createClient } from "@/lib/supabase/client";

interface Props {
  settings: RegistrationSettingsRow;
  profileId: string | null;
  initialName: string;
  initialRegistration: Pick<EventRegistrationRow, "id" | "display_name" | "status"> | null;
  publicRegistrations: Array<Pick<EventRegistrationRow, "id" | "display_name" | "status">>;
}

const statusCopy = {
  pending: ["Awaiting approval", "The organizer has received your registration."],
  approved: ["Place confirmed", "Check in with the organizer when you arrive."],
  waitlisted: ["On the waitlist", "The organizer can confirm you if a place opens."],
  checked_in: ["Checked in", "You are ready for the draw."],
  withdrawn: ["Registration withdrawn", "You can submit a new entry while registration is open."],
  rejected: ["Registration not accepted", "Contact the organizer if you need more information."],
} as const;

export function TournamentRegistrationForm({
  settings,
  profileId,
  initialName,
  initialRegistration,
  publicRegistrations,
}: Props) {
  const [name, setName] = useState(initialName);
  const [registration, setRegistration] = useState(initialRegistration);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateRegistrationName(name);
    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("event_registrations").insert({
        tournament_id: settings.tournament_id,
        profile_id: profileId,
        display_name: validation.value,
        status: "pending",
        source: "self",
      });
      if (error) throw error;
      setRegistration({ id: "submitted", display_name: validation.value, status: "pending" });
      setName(validation.value);
    } catch (error) {
      const detail = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
      setMessage(detail === "23505"
        ? "That tournament name is already registered. Choose another name or sign in to check your existing entry."
        : error instanceof Error ? error.message : "Registration could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!registration || !profileId || registration.id === "submitted") return;
    if (!window.confirm("Withdraw your registration from this event?")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("event_registrations")
        .update({ status: "withdrawn" })
        .eq("id", registration.id);
      if (error) throw error;
      setRegistration({ ...registration, status: "withdrawn" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to withdraw registration.");
    } finally {
      setBusy(false);
    }
  }

  const activeRegistration = registration && !["withdrawn", "rejected"].includes(registration.status);
  const statusText = registration ? statusCopy[registration.status] : null;
  const confirmed = publicRegistrations.filter((item) => item.status === "approved" || item.status === "checked_in");
  const waitlisted = publicRegistrations.filter((item) => item.status === "waitlisted");
  const nextPath = `/register/${settings.tournament_id}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 sm:p-7">
        {activeRegistration && statusText ? (
          <div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300/10 text-2xl ring-1 ring-emerald-300/20">
              {registration.status === "checked_in" ? "✓" : "🎱"}
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{statusText[0]}</p>
            <h2 className="mt-2 text-3xl font-black text-white">{registration.display_name}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{statusText[1]}</p>
            {profileId && registration.id !== "submitted" ? (
              <button type="button" disabled={busy} onClick={() => void withdraw()} className="mt-6 rounded-2xl border border-rose-300/20 px-4 py-3 text-sm font-bold text-rose-200 hover:bg-rose-300/10 disabled:opacity-40">Withdraw registration</button>
            ) : null}
          </div>
        ) : settings.registration_open ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Join the player list</p>
            <h2 className="mt-2 text-3xl font-black">Register for this event</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Choose the name you want shown in the draw. The organizer will approve your place.
            </p>
            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-bold text-slate-300">
                Tournament name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="e.g. The Breaker"
                  className="mt-2 min-h-13 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                />
              </label>
              {message ? <p role="alert" className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-100">{message}</p> : null}
              <button type="submit" disabled={busy} className="mt-5 min-h-13 w-full rounded-2xl bg-cyan-400 px-5 py-3.5 font-black text-slate-950 shadow-lg shadow-cyan-500/15 hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-50">
                {busy ? "Sending…" : "Request my place"}
              </button>
            </form>
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-xs leading-5 text-slate-500">
              No account required. {profileId ? "Your CueBracket tournament name has been filled in for you." : <><a href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="font-black text-cyan-300">Sign in</a> or <a href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="font-black text-cyan-300">create a profile</a> to reuse your player name and track future tournament benefits.</>}
            </div>
          </>
        ) : (
          <div className="py-5 text-center">
            <div className="text-5xl">🔒</div>
            <h2 className="mt-5 text-3xl font-black">Registration is closed</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Contact the organizer if you need a late entry.</p>
          </div>
        )}
      </section>

      <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Player list</p>
            <h2 className="mt-2 text-xl font-black">{confirmed.length} of {settings.capacity} confirmed</h2>
          </div>
          <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-sm font-black text-cyan-200 ring-1 ring-cyan-300/20">{Math.max(0, settings.capacity - confirmed.length)} left</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/80">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${Math.min(100, confirmed.length / settings.capacity * 100)}%` }} />
        </div>
        <div className="mt-6 space-y-2">
          {confirmed.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-300/10 text-xs font-black text-cyan-200">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-white">{item.display_name}</span>
              {item.status === "checked_in" ? <span className="text-xs font-black text-emerald-300">Checked in</span> : null}
            </div>
          ))}
          {!confirmed.length ? <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-600">Confirmed players will appear here.</p> : null}
        </div>
        {waitlisted.length ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Waitlist · {waitlisted.length}</p>
            <p className="mt-2 text-sm text-slate-500">{waitlisted.map((item) => item.display_name).join(" · ")}</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
