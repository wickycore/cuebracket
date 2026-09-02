"use client";

import { useMemo, useState } from "react";
import {
  eventDateGroup,
  eventHasSpace,
  eventSearchText,
  sortDiscoveryEvents,
  type DiscoveryDateFilter,
  type DiscoveryEvent,
  type DiscoveryEventType,
} from "@/lib/events";

const dateFilters: Array<[DiscoveryDateFilter, string]> = [
  ["all", "All dates"],
  ["week", "Next 7 days"],
  ["month", "This month"],
  ["later", "Later"],
  ["tba", "Date TBA"],
];

const formatDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

const formatTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
  timeZoneName: "short",
});

function displayDate(value: string | null) {
  if (!value) return { date: "Date to be announced", time: "Follow the club for updates" };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: "Date to be announced", time: "Follow the club for updates" };
  return { date: formatDate.format(date), time: formatTime.format(date) };
}

function monthKey(value: string | null) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

export function EventDiscovery({ events, signedIn }: { events: DiscoveryEvent[]; signedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | DiscoveryEventType>("all");
  const [date, setDate] = useState<DiscoveryDateFilter>("all");
  const [club, setClub] = useState("all");
  const [format, setFormat] = useState("all");
  const [availability, setAvailability] = useState<"all" | "open" | "followed">("all");

  const clubs = useMemo(() => Array.from(new Map(events.filter((event) => event.clubId).map((event) => [event.clubId, event.clubName])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [events]);
  const formats = useMemo(() => [...new Set(events.map((event) => event.format).filter(Boolean))].sort(), [events]);
  const visible = useMemo(() => sortDiscoveryEvents(events.filter((event) => {
    if (query.trim() && !eventSearchText(event).includes(query.trim().toLowerCase())) return false;
    if (type !== "all" && event.type !== type) return false;
    if (date !== "all" && eventDateGroup(event.startsAt) !== date) return false;
    if (club !== "all" && event.clubId !== club) return false;
    if (format !== "all" && event.format !== format) return false;
    if (availability === "open" && (!event.registrationOpen || !eventHasSpace(event))) return false;
    if (availability === "followed" && !event.followed) return false;
    return true;
  })), [availability, club, date, events, format, query, type]);
  const groups = useMemo(() => {
    const grouped = new Map<string, DiscoveryEvent[]>();
    visible.forEach((event) => grouped.set(monthKey(event.startsAt), [...(grouped.get(monthKey(event.startsAt)) ?? []), event]));
    return [...grouped.entries()];
  }, [visible]);
  const activeFilters = [query.trim(), type !== "all", date !== "all", club !== "all", format !== "all", availability !== "all"].filter(Boolean).length;

  function reset() {
    setQuery(""); setType("all"); setDate("all"); setClub("all"); setFormat("all"); setAvailability("all");
  }

  return (
    <>
      <section className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-4 shadow-2xl shadow-black/20 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.6fr)_repeat(3,minmax(9rem,1fr))]">
          <label className="relative">
            <span className="sr-only">Search events</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, venue or club" className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 pl-10 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/50" />
          </label>
          <select value={date} onChange={(event) => setDate(event.target.value as DiscoveryDateFilter)} aria-label="Filter by date" className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm font-bold text-white">
            {dateFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={club} onChange={(event) => setClub(event.target.value)} aria-label="Filter by club" className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm font-bold text-white">
            <option value="all">All clubs</option>
            {clubs.map(([id, name]) => <option key={id} value={id ?? ""}>{name}</option>)}
          </select>
          <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Filter by game or format" className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm font-bold text-white">
            <option value="all">All games & formats</option>
            {formats.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["all", "tournament", "league"] as const).map((value) => <button key={value} type="button" onClick={() => setType(value)} className={`rounded-xl px-3 py-2 text-xs font-black capitalize transition ${type === value ? "bg-cyan-400 text-slate-950" : "bg-white/[0.045] text-slate-300 ring-1 ring-white/10"}`}>{value === "all" ? "All events" : `${value}s`}</button>)}
          <button type="button" onClick={() => setAvailability(availability === "open" ? "all" : "open")} className={`rounded-xl px-3 py-2 text-xs font-black transition ${availability === "open" ? "bg-emerald-300 text-slate-950" : "bg-white/[0.045] text-slate-300 ring-1 ring-white/10"}`}>Spaces available</button>
          {signedIn ? <button type="button" onClick={() => setAvailability(availability === "followed" ? "all" : "followed")} className={`rounded-xl px-3 py-2 text-xs font-black transition ${availability === "followed" ? "bg-violet-300 text-slate-950" : "bg-white/[0.045] text-slate-300 ring-1 ring-white/10"}`}>Clubs I follow</button> : null}
          {activeFilters ? <button type="button" onClick={reset} className="ml-auto px-2 py-2 text-xs font-black text-cyan-300">Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}</button> : null}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-400"><span className="font-black text-white">{visible.length}</span> event{visible.length === 1 ? "" : "s"} found</p>
        <p className="hidden text-xs font-bold text-slate-400 sm:block">Times shown in East Africa Time</p>
      </div>

      {groups.length ? <div className="mt-5 space-y-9">{groups.map(([month, monthEvents]) => (
        <section key={month}>
          <div className="flex items-center gap-4"><h2 className="shrink-0 text-sm font-black uppercase tracking-[0.2em] text-cyan-300">{month}</h2><div className="h-px flex-1 bg-gradient-to-r from-cyan-400/25 to-transparent" /></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{monthEvents.map((event) => <EventCard key={`${event.type}-${event.id}`} event={event} />)}</div>
        </section>
      ))}</div> : (
        <section className="mt-5 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] px-6 py-16 text-center">
          <p className="text-4xl">🎱</p><h2 className="mt-4 text-2xl font-black">No events match those filters</h2><p className="mt-2 text-slate-400">Clear a filter or check again when organizers publish new events.</p><button type="button" onClick={reset} className="mt-5 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950">Show all events</button>
        </section>
      )}
    </>
  );
}

function EventCard({ event }: { event: DiscoveryEvent }) {
  const when = displayDate(event.startsAt);
  const spaces = event.capacity === null ? null : Math.max(0, event.capacity - event.confirmed);
  const full = !eventHasSpace(event);
  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,.96),rgba(5,12,28,.98))] transition hover:-translate-y-0.5 hover:border-cyan-400/25">
      <div className={`h-1 ${event.type === "league" ? "bg-gradient-to-r from-violet-400 to-cyan-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${event.type === "league" ? "bg-violet-300/10 text-violet-200 ring-1 ring-violet-300/20" : "bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20"}`}>{event.type}</span>
              {event.followed ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-black uppercase text-amber-200 ring-1 ring-amber-300/20">★ Followed club</span> : null}
              {event.status === "live" ? <span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-xs font-black uppercase text-rose-200 ring-1 ring-rose-300/20">● Live</span> : null}
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{event.name}</h3>
            <p className="mt-2 text-sm font-bold text-slate-400">{event.clubSlug ? <a href={`/clubs/${event.clubSlug}`} className="text-cyan-300 hover:text-cyan-200">{event.clubName}</a> : event.clubName}{event.venue ? ` · ${event.venue}` : ""}</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-center"><p className="text-xs font-black text-white">{event.raceTo ? `R${event.raceTo}` : "—"}</p><p className="mt-0.5 text-xs font-black uppercase text-slate-400">Race</p></div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">When</p><p className="mt-2 font-black text-white">{when.date}</p><p className="mt-1 text-xs text-slate-400">{when.time}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Game / format</p><p className="mt-2 font-black capitalize text-white">{event.format.replaceAll("_", " ").replaceAll("-", " ")}</p><p className="mt-1 text-xs text-slate-400">{event.entryFee || "Entry fee not listed"}</p></div>
        </div>

        {event.type === "tournament" ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3 text-xs font-bold"><span className="text-slate-400">{event.confirmed}/{event.capacity} confirmed{event.waitlisted ? ` · ${event.waitlisted} waiting` : ""}</span><span className={full ? "text-amber-300" : "text-emerald-300"}>{full ? "Waitlist available" : `${spaces} space${spaces === 1 ? "" : "s"} left`}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900"><div className={`h-full rounded-full ${full ? "bg-amber-300" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`} style={{ width: `${Math.min(100, event.capacity ? event.confirmed / event.capacity * 100 : 0)}%` }} /></div>
        </div> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href={event.href} className={`rounded-xl px-5 py-3 text-sm font-black transition ${event.registrationOpen ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "bg-violet-300 text-slate-950 hover:bg-violet-200"}`}>{event.registrationOpen ? (full ? "Join waitlist →" : "Register now →") : event.status === "live" ? "Open live league →" : "View league →"}</a>
          {event.clubSlug ? <a href={`/clubs/${event.clubSlug}`} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.05]">View club</a> : null}
        </div>
      </div>
    </article>
  );
}
