"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  clubCalendarKindLabel,
  clubDateLabel,
  type ClubCalendarEventRow,
  type ClubCalendarKind,
  type ClubCalendarResponse,
  type ClubCalendarRecurrence,
  type ClubCalendarRsvpRow,
} from "@/lib/club-command-center";
import { createClubCalendarEvent, setClubCalendarEventCancelled, setClubCalendarRsvp } from "@/lib/cloud/club-calendar";

interface Props {
  clubId: string;
  clubSlug: string;
  isAdmin: boolean;
  isMember: boolean;
  userId: string | null;
  initialEvents: ClubCalendarEventRow[];
  initialRsvps: ClubCalendarRsvpRow[];
}

const kindTone: Record<ClubCalendarKind, string> = {
  tournament: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  practice: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  meeting: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  social: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  other: "border-slate-300/15 bg-slate-300/[0.07] text-slate-300",
};

export function ClubCalendarBoard({ clubId, clubSlug, isAdmin, isMember, userId, initialEvents, initialRsvps }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [responses, setResponses] = useState(() => new Map(initialRsvps.map((item) => [item.event_id, item.response])));
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ClubCalendarKind>("practice");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [recurrence, setRecurrence] = useState<ClubCalendarRecurrence>("none");
  const [recurrenceCount, setRecurrenceCount] = useState("8");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await action();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That calendar action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("create", async () => {
      const created = await createClubCalendarEvent({
        clubId,
        title,
        kind,
        description,
        startsAt,
        endsAt: endsAt || null,
        location,
        capacity: capacity ? Number(capacity) : null,
        recurrence,
        recurrenceCount: recurrence === "weekly" ? Number(recurrenceCount) : 1,
      });
      setEvents((current) => [...current, ...created].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setTitle(""); setStartsAt(""); setEndsAt(""); setDescription(""); setCapacity("");
      setMessage(created.length > 1 ? `${created.length} weekly events added to the calendar.` : "Club event added to the calendar.");
    });
  }

  function rsvp(item: ClubCalendarEventRow, response: ClubCalendarResponse | null) {
    void run(`rsvp-${item.id}-${response ?? "remove"}`, async () => {
      const previous = responses.get(item.id) ?? null;
      await setClubCalendarRsvp(item.id, response);
      setResponses((current) => {
        const next = new Map(current);
        if (response) next.set(item.id, response); else next.delete(item.id);
        return next;
      });
      setEvents((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        going_count: Math.max(0, entry.going_count - (previous === "going" ? 1 : 0) + (response === "going" ? 1 : 0)),
        maybe_count: Math.max(0, entry.maybe_count - (previous === "maybe" ? 1 : 0) + (response === "maybe" ? 1 : 0)),
      } : entry));
      setMessage(response ? `RSVP saved: ${response}.` : "Your RSVP was removed.");
    });
  }

  function toggleCancelled(item: ClubCalendarEventRow) {
    void run(`cancel-${item.id}`, async () => {
      const updated = await setClubCalendarEventCancelled(item.id, !item.is_cancelled);
      setEvents((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setMessage(updated.is_cancelled ? "Event cancelled." : "Event restored.");
    });
  }

  return (
    <section className="rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,.1),transparent_22rem),rgba(15,23,42,.65)] p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="cb-kicker !text-emerald-300">Plan together</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Club calendar & RSVPs</h2><p className="mt-2 text-sm leading-6 text-slate-400">Practice nights, meetings and socials sit beside the tournament schedule.</p></div>
        <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">{events.filter((item) => !item.is_cancelled && new Date(item.starts_at) > new Date()).length} upcoming</span>
      </div>

      {isAdmin ? <details className="mt-5 rounded-2xl border border-emerald-300/15 bg-slate-950/40 p-4 sm:p-5"><summary className="cursor-pointer list-none font-black text-emerald-100">+ Add a club calendar event</summary><form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]"><select value={kind} onChange={(event) => setKind(event.target.value as ClubCalendarKind)} aria-label="Event type" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold"><option value="practice">Practice</option><option value="tournament">Tournament</option><option value="meeting">Meeting</option><option value="social">Social</option><option value="other">Other</option></select><input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={100} required placeholder="Event title" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 font-bold outline-none focus:border-emerald-300/40" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-wider text-slate-400">Starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white" /></label><label className="text-xs font-black uppercase tracking-wider text-slate-400">Ends (optional)<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white" /></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-wider text-slate-400">Repeats<select value={recurrence} onChange={(event) => setRecurrence(event.target.value as ClubCalendarRecurrence)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white"><option value="none">Does not repeat</option><option value="weekly">Every week</option></select></label>{recurrence === "weekly" ? <label className="text-xs font-black uppercase tracking-wider text-slate-400">Number of weeks<input type="number" value={recurrenceCount} onChange={(event) => setRecurrenceCount(event.target.value)} min={2} max={52} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white" /></label> : <div className="self-end rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs font-bold leading-5 text-slate-400">Choose weekly for league nights, regular practice or recurring meetings.</div>}</div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]"><input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} placeholder="Location or table area" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 font-bold" /><input type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} min={2} max={500} placeholder="Capacity" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 font-bold" /></div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="Optional details" className="resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3" />
        <button type="submit" disabled={Boolean(busy)} className="min-h-12 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{busy === "create" ? "Adding…" : "Add to calendar"}</button>
      </form></details> : null}

      {message ? <p role="status" className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">{message}</p> : null}

      {events.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{events.map((item) => {
        const ownResponse = responses.get(item.id) ?? null;
        const full = item.capacity !== null && item.going_count >= item.capacity;
        const started = new Date(item.starts_at) <= new Date();
        return <article key={item.id} className={`rounded-2xl border p-5 ${item.is_cancelled ? "border-rose-300/15 bg-rose-300/[0.035] opacity-75" : "border-white/10 bg-slate-950/45"}`}><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wider ${kindTone[item.kind]}`}>{clubCalendarKindLabel(item.kind)}</span><h3 className="mt-3 text-lg font-black">{item.title}</h3></div>{item.is_cancelled ? <span className="text-xs font-black uppercase text-rose-300">Cancelled</span> : null}</div>
          <p className="mt-3 text-sm font-black text-white">{clubDateLabel(item.starts_at)}</p><p className="mt-1 text-sm font-bold text-slate-400">{item.location || "Location to be announced"}</p>{item.recurrence === "weekly" ? <p className="mt-2 inline-flex rounded-full border border-violet-300/15 bg-violet-300/10 px-2.5 py-1 text-xs font-black text-violet-200">↻ Weekly series</p> : null}{item.description ? <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black"><span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-emerald-200">{item.going_count}{item.capacity ? `/${item.capacity}` : ""} going</span><span className="rounded-full bg-amber-300/10 px-3 py-1.5 text-amber-200">{item.maybe_count} maybe</span>{full ? <span className="text-rose-300">Full</span> : null}</div>
          {!item.is_cancelled && !started ? userId && isMember ? <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={() => rsvp(item, ownResponse === "going" ? null : "going")} disabled={Boolean(busy) || (full && ownResponse !== "going")} className={`min-h-11 rounded-xl text-sm font-black ${ownResponse === "going" ? "bg-emerald-400 text-slate-950" : "border border-white/10 text-slate-300"}`}>{ownResponse === "going" ? "✓ Going" : "Going"}</button><button type="button" onClick={() => rsvp(item, ownResponse === "maybe" ? null : "maybe")} disabled={Boolean(busy)} className={`min-h-11 rounded-xl text-sm font-black ${ownResponse === "maybe" ? "bg-amber-300 text-slate-950" : "border border-white/10 text-slate-300"}`}>{ownResponse === "maybe" ? "✓ Maybe" : "Maybe"}</button>{isAdmin ? <button type="button" onClick={() => toggleCancelled(item)} disabled={Boolean(busy)} className="min-h-11 rounded-xl border border-rose-300/20 text-sm font-black text-rose-200">Cancel</button> : <span />}</div> : userId ? <p className="mt-4 text-xs font-bold text-slate-400">Join the club to RSVP.</p> : <Link href={`/auth/login?next=${encodeURIComponent(`/clubs/${clubSlug}?tab=events`)}`} className="mt-4 inline-flex text-sm font-black text-emerald-300">Sign in to RSVP →</Link> : isAdmin ? <button type="button" onClick={() => toggleCancelled(item)} disabled={Boolean(busy)} className="mt-4 text-xs font-black text-emerald-300">Restore event</button> : null}
        </article>;
      })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><p className="font-black text-slate-300">The club calendar is ready.</p><p className="mt-2 text-sm text-slate-400">Organizers can add practice sessions, meetings and socials here.</p></div>}
    </section>
  );
}
