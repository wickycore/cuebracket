"use client";

import { useState, type FormEvent } from "react";

import type { ClubReportCategory } from "@/lib/club-command-center";
import { reportClubMember } from "@/lib/cloud/club-moderation";

export function ClubReportMemberButton({ clubId, memberId, memberName }: { clubId: string; memberId: string; memberName: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ClubReportCategory>("club_rules");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await reportClubMember({ clubId, reportedUserId: memberId, reportedName: memberName, category, details });
      setDetails("");
      setMessage("Report sent privately to club organizers.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That report could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 border-t border-white/8 pt-3">
    <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-black text-slate-400 hover:text-rose-200">{open ? "Close report form" : "Report member"}</button>
    {open ? <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3"><p className="text-xs font-bold leading-5 text-slate-300">This is sent only to club organizers. The reported member will not see who reported them.</p><label className="block text-xs font-black text-slate-300">Reason<select value={category} onChange={(event) => setCategory(event.target.value as ClubReportCategory)} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-white"><option value="club_rules">Club rules</option><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="unsafe_conduct">Unsafe conduct</option><option value="other">Other</option></select></label><label className="block text-xs font-black text-slate-300">What happened?<textarea value={details} onChange={(event) => setDetails(event.target.value)} minLength={5} maxLength={800} required rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" /></label><button type="submit" disabled={busy} className="min-h-10 w-full rounded-lg bg-rose-300 px-3 text-xs font-black text-slate-950 disabled:opacity-50">{busy ? "Sending…" : "Send private report"}</button>{message ? <p role="status" className="text-xs font-bold leading-5 text-slate-300">{message}</p> : null}</form> : null}
  </div>;
}
