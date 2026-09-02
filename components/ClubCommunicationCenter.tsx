"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CLUB_BROADCAST_TEMPLATES, clubBroadcastAudienceLabel, type ClubBroadcastAudience, type ClubBroadcastRow, type ClubBroadcastTemplate } from "@/lib/club-communications";
import { sendClubBroadcast } from "@/lib/cloud/club-communications";

export function ClubCommunicationCenter({ clubId, clubName, initialBroadcasts }: { clubId: string; clubName: string; initialBroadcasts: ClubBroadcastRow[] }) {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [audience, setAudience] = useState<ClubBroadcastAudience>("everyone");
  const [template, setTemplate] = useState<ClubBroadcastTemplate>("general");
  const selected = CLUB_BROADCAST_TEMPLATES.find((item) => item.id === template)!;
  const [title, setTitle] = useState(selected.title);
  const [message, setMessage] = useState(selected.message);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  function chooseTemplate(next: ClubBroadcastTemplate) {
    const item = CLUB_BROADCAST_TEMPLATES.find((candidate) => candidate.id === next)!;
    setTemplate(next);
    setTitle(item.title);
    setMessage(item.message);
    setNotice("");
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(""); setFailed(false);
    try {
      const created = await sendClubBroadcast({ clubId, audience, template, title, message });
      setBroadcasts((current) => [created, ...current]);
      setNotice(created.recipient_count
        ? `Sent to ${created.recipient_count} opted-in ${created.recipient_count === 1 ? "person" : "people"}.`
        : "Published, but nobody in that audience currently has club messages enabled.");
      setTitle(selected.title); setMessage(selected.message);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setNotice(error instanceof Error ? error.message : "The club update could not be sent.");
    } finally { setBusy(false); }
  }

  return <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-900/65">
    <div className="border-b border-white/10 p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker">Club communications</p><h3 className="mt-2 text-2xl font-black">Reach the right people</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Send one organized {clubName} inbox update instead of relying on a noisy group chat. Phone delivery remains opt-in.</p></div><span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-200">RSVP reminders automatic</span></div></div>

    <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.72fr)]">
      <form onSubmit={publish} className="border-b border-white/10 p-5 sm:p-7 xl:border-b-0 xl:border-r">
        <fieldset><legend className="text-xs font-black uppercase tracking-wider text-slate-400">Quick template</legend><div className="mt-3 flex flex-wrap gap-2">{CLUB_BROADCAST_TEMPLATES.map((item) => <button key={item.id} type="button" onClick={() => chooseTemplate(item.id)} className={`rounded-xl border px-3 py-2 text-xs font-black ${template === item.id ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 text-slate-400 hover:text-white"}`}>{item.label}</button>)}</div></fieldset>
        <div className="mt-5 grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><label className="text-sm font-bold text-slate-300">Audience<select value={audience} onChange={(event) => setAudience(event.target.value as ClubBroadcastAudience)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-300/40"><option value="everyone">Members & followers</option><option value="members">Members only</option><option value="followers">Followers only</option></select></label><label className="text-sm font-bold text-slate-300">Title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={100} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-white outline-none focus:border-cyan-300/40" /></label></div>
        <label className="mt-4 block text-sm font-bold text-slate-300">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={3} maxLength={500} rows={5} required className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300/40" /><span className="mt-1 block text-right text-xs text-slate-400">{message.length}/500</span></label>
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-xs leading-5 text-slate-400">Recipients who turned off club messages are excluded. This action is limited to five sends per organizer every ten minutes.</div>
        <button type="submit" disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Sending…" : `Send to ${clubBroadcastAudienceLabel(audience).toLowerCase()}`}</button>
        {notice ? <p role={failed ? "alert" : "status"} className={`mt-4 text-sm font-bold ${failed ? "text-amber-200" : "text-emerald-200"}`}>{notice}</p> : null}
      </form>

      <div className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Recent sends</p><h4 className="mt-1 text-xl font-black">Delivery overview</h4></div><button type="button" onClick={() => router.refresh()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-400">Refresh</button></div>
        {broadcasts.length ? <div className="mt-4 space-y-3">{broadcasts.slice(0, 8).map((item) => { const rate = item.recipient_count ? Math.round(item.opened_count / item.recipient_count * 100) : 0; return <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-white">{item.title}</p><p className="mt-1 text-xs font-bold text-slate-400">{clubBroadcastAudienceLabel(item.audience)} · {new Date(item.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-black uppercase text-cyan-200">{item.template}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><span className="rounded-lg bg-white/[0.035] p-2"><span className="block font-black text-white">{item.recipient_count}</span><span className="text-xs font-bold uppercase text-slate-400">Inbox</span></span><span className="rounded-lg bg-white/[0.035] p-2"><span className="block font-black text-cyan-300">{item.opened_count}</span><span className="text-xs font-bold uppercase text-slate-400">Opened</span></span><span className="rounded-lg bg-white/[0.035] p-2"><span className="block font-black text-emerald-300">{item.phone_sent_count}</span><span className="text-xs font-bold uppercase text-slate-400">Phone</span></span><span className="rounded-lg bg-white/[0.035] p-2"><span className="block font-black text-amber-300">{item.phone_failed_count}</span><span className="text-xs font-bold uppercase text-slate-400">Failed</span></span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${rate}%` }} /></div><p className="mt-2 text-right text-xs font-bold text-slate-400">{rate}% inbox open rate</p></article>; })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center"><p className="font-black text-slate-300">No club messages yet</p><p className="mt-2 text-sm leading-6 text-slate-400">Your delivery history will appear here after the first send.</p></div>}
        <p className="mt-4 text-xs leading-5 text-slate-400">Phone counts reflect push-provider acceptance, not guaranteed screen display. No private device details or follower lists are shown.</p>
      </div>
    </div>
  </section>;
}
