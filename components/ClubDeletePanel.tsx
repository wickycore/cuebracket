"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteClub } from "@/lib/cloud/clubs";
import type { ClubRow } from "@/lib/clubs";

export function ClubDeletePanel({ club }: { club: ClubRow }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const confirmed = confirmation === club.name;

  async function removeClub() {
    if (!confirmed || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteClub(club.id);
      router.replace("/clubs");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The club could not be deleted.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-rose-300/20 bg-rose-950/10 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">Owner danger zone</p>
          <h2 className="mt-2 text-2xl font-black text-white">Delete this club</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">This permanently removes the club page, members, requests, followers, announcements, calendar, gallery, achievements, challenges and club tables. Existing tournaments and leagues stay in their organizers&apos; accounts but are detached from the club.</p>
        </div>
        {!isOpen ? <button type="button" onClick={() => setIsOpen(true)} className="min-h-11 shrink-0 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm font-black text-rose-200 hover:bg-rose-300/15">Delete club…</button> : null}
      </div>

      {isOpen ? <div className="mt-6 rounded-2xl border border-rose-300/20 bg-slate-950/60 p-4 sm:p-5">
        <label htmlFor="delete-club-confirmation" className="text-sm font-bold text-slate-200">Type <span className="font-black text-white">{club.name}</span> to confirm</label>
        <input id="delete-club-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" className="mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-rose-300/50 disabled:opacity-60" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void removeClub()} disabled={!confirmed || busy} className="min-h-11 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{busy ? "Deleting club…" : "Permanently delete club"}</button>
          <button type="button" onClick={() => { setIsOpen(false); setConfirmation(""); setMessage(""); }} disabled={busy} className="min-h-11 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-60">Cancel</button>
        </div>
        {message ? <p role="alert" className="mt-4 text-sm font-bold text-rose-200">{message}</p> : null}
      </div> : null}
    </section>
  );
}
