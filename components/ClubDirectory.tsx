"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { RemoteMedia } from "@/components/RemoteMedia";
import type { ClubRow } from "@/lib/clubs";

type ClubWithCount = ClubRow & { memberCount: number };

export function ClubDirectory({ clubs }: { clubs: ClubWithCount[] }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const locations = useMemo(() => [...new Set(clubs.map((club) => club.location.trim()).filter(Boolean))].sort(), [clubs]);
  const visibleClubs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clubs.filter((club) => {
      const matchesQuery = !needle || `${club.name} ${club.location} ${club.description}`.toLowerCase().includes(needle);
      const matchesLocation = location === "all" || club.location === location;
      return matchesQuery && matchesLocation;
    });
  }, [clubs, location, query]);

  return <>
    <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <label className="sr-only" htmlFor="club-search">Search clubs</label>
      <input id="club-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by club name, location or description" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40" />
      <label className="sr-only" htmlFor="club-location">Filter by location</label>
      <select id="club-location" value={location} onChange={(event) => setLocation(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-cyan-400/40">
        <option value="all">All locations</option>
        {locations.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>

    {visibleClubs.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleClubs.map((club) => <Link key={club.id} href={`/clubs/${club.slug}`} className="group rounded-[1.75rem] border border-white/10 bg-slate-900/65 p-6 transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-2xl font-black text-cyan-200">{club.logo_url ? <RemoteMedia src={club.logo_url} alt={`${club.name} logo`} width={112} height={112} sizes="56px" /> : club.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0"><h3 className="truncate text-xl font-black group-hover:text-cyan-200">{club.name}</h3><p className="mt-1 truncate text-sm font-bold text-slate-400">{club.location || "Online club"}</p></div>
        </div>
        <p className="mt-5 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-400">{club.description || "Follow this club to discover its next CueBracket tournament."}</p>
        <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-black uppercase tracking-wider text-slate-400">{club.memberCount > 1 ? <span>{club.memberCount} members</span> : <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-200">New club</span>}<span className="ml-auto text-cyan-300">View club →</span></div>
      </Link>)}
    </div> : <div className="mt-5 rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-10 text-center"><p className="text-xl font-black">No clubs match those filters.</p><p className="mt-2 text-sm text-slate-400">Try another name or choose all locations.</p><button type="button" onClick={() => { setQuery(""); setLocation("all"); }} className="mt-4 rounded-xl border border-cyan-300/20 px-4 py-2 text-sm font-black text-cyan-200">Clear filters</button></div>}
  </>;
}
