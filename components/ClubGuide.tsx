"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateClubGuide } from "@/lib/player-following";

export function ClubGuide({ clubId, isAdmin, location }: { clubId: string; isAdmin: boolean; location: string }) {
  const [hours, setHours] = useState("");
  const [rules, setRules] = useState("");
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await createClient().from("club_guides").select("opening_hours,rules").eq("club_id", clubId).maybeSingle();
      if (!alive) return;
      setLoading(false); setLoadError(Boolean(error));
      if (error) { setMessage("The club guide could not be loaded."); return; }
      setMessage(""); setExists(Boolean(data)); setHours(data?.opening_hours ?? ""); setRules(data?.rules ?? "");
    })();
    return () => { alive = false; };
  }, [clubId, retry]);

  async function save() {
    const problem = validateClubGuide(hours, rules);
    if (problem) { setMessage(problem); return; }
    setBusy(true); setMessage("");
    try {
      const db = createClient();
      const fields = { opening_hours: hours.trim(), rules: rules.trim() };
      const result = exists ? await db.from("club_guides").update(fields).eq("club_id", clubId).select("club_id").single() : await db.from("club_guides").insert({ club_id: clubId, ...fields }).select("club_id").single();
      if (result.error) throw result.error;
      setExists(true); setEditing(false); setMessage("Club guide saved.");
    } catch { setMessage("Could not save. You must be a club admin; refresh if another admin has just created the guide."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
    <div className="flex items-start justify-between gap-3"><div><p className="cb-kicker">Before you visit</p><h2 className="mt-2 text-2xl font-black">Club guide</h2></div>{isAdmin && !loading && !loadError && !editing ? <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl border border-cyan-300/25 px-4 text-xs font-black text-cyan-300">Edit guide</button> : null}</div>
    {loading ? <p className="mt-4 text-slate-500">Loading guide…</p> : loadError ? <button type="button" onClick={() => { setLoading(true); setRetry((n) => n + 1); }} className="mt-4 text-sm text-cyan-300 underline">Retry loading guide</button> : editing ? <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="block text-sm font-bold text-slate-300">Opening hours<textarea value={hours} onChange={(event) => setHours(event.target.value)} maxLength={500} rows={3} placeholder="Add your actual opening days and hours" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm font-normal" /></label>
      <label className="block text-sm font-bold text-slate-300">House rules & visitor information<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={3000} rows={7} placeholder="House rules, equipment, accessibility and what visitors should know" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm font-normal" /></label>
      <div className="flex gap-3"><button disabled={busy} className="min-h-11 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Saving…" : "Save guide"}</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setLoading(true); setRetry((n) => n + 1); }} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm">Cancel</button></div>
    </form> : <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Opening hours</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{hours || "Hours have not been published yet. Check with the club before visiting."}</p>{location ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-black text-cyan-300">Find {location} on Maps ↗</a> : null}</div><div><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">House rules</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{rules || "The club has not published its house rules yet."}</p></div></div>}
    {message ? <p role="status" className="mt-4 text-sm text-amber-200">{message}</p> : null}
  </section>;
}
