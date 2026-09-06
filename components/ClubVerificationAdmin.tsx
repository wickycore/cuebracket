"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface EligibleClub { club_id: string; club_name: string; club_slug: string; club_location: string; completed_event_count: number; approved_member_count: number }

export function ClubVerificationAdmin({ initialClubs }: { initialClubs: EligibleClub[] }) {
  const [clubs, setClubs] = useState(initialClubs);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  async function approve(club: EligibleClub) {
    if (!window.confirm(`Verify ${club.club_name}? This publicly grants the CueBracket trust badge.`)) return;
    setBusyId(club.club_id); setMessage("");
    const { error } = await createClient().rpc("approve_club_verification", { target_club: club.club_id });
    if (error) setMessage(error.message);
    else { setClubs((current) => current.filter((item) => item.club_id !== club.club_id)); setMessage(`${club.club_name} is now a verified CueBracket club.`); }
    setBusyId("");
  }
  return <div>{message ? <p role="status" className="mb-5 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}<div className="space-y-3">{clubs.length ? clubs.map((club) => <article key={club.club_id} className="flex flex-col gap-4 rounded-2xl border border-teal-300/15 bg-slate-900/70 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><Link href={`/clubs/${club.club_slug}`} className="text-lg font-black text-white hover:text-cyan-200">{club.club_name} ↗</Link><p className="mt-1 text-sm text-slate-400">{club.club_location}</p><p className="mt-2 text-xs font-bold text-slate-300">{club.completed_event_count} completed events · {club.approved_member_count} approved members</p></div><button type="button" disabled={busyId === club.club_id} onClick={() => void approve(club)} className="min-h-11 rounded-xl bg-teal-300 px-5 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50">{busyId === club.club_id ? "Verifying…" : "Approve verification"}</button></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">No unverified clubs currently meet every trust requirement.</div>}</div></div>;
}
