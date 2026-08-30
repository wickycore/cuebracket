"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { liveMatchHref, liveMatchKey, uniqueLiveMatches, type PlayerLiveMatch } from "@/lib/player-following";

export function LiveMatchFeed({ clubId, playerIds, enabled = true }: { clubId?: string; playerIds?: string[]; enabled?: boolean }) {
  const [matches, setMatches] = useState<PlayerLiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [loadedScope, setLoadedScope] = useState("");
  const [refresh, setRefresh] = useState(0);
  const idsKey = JSON.stringify(playerIds ?? null);
  const scope = `${clubId ?? ""}:${idsKey}`;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const ids = JSON.parse(idsKey) as string[] | null;
    const supabase = createClient();
    async function load() {
      if (inFlight || document.hidden || !enabled) return;
      inFlight = true;
      try {
        const rows: PlayerLiveMatch[] = [];
        if (clubId || ids?.length) {
          const batches = ids ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, index * 100 + 100)) : [null];
          for (const batch of batches) {
            let request = supabase.from("player_live_matches").select("profile_id,event_type,event_id,match_key,event_name,player1,player2,score1,score2,table_name,updated_at").is("ended_at", null).order("updated_at", { ascending: false }).limit(200);
            if (clubId) request = request.eq("club_id", clubId);
            if (batch) request = request.in("profile_id", batch);
            const { data, error } = await request;
            if (error) throw error;
            rows.push(...data as PlayerLiveMatch[]);
          }
        }
        if (alive) { setMatches(uniqueLiveMatches(rows).slice(0, 100)); setLoadedScope(scope); setError(""); setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
      } catch {
        if (alive) { setMatches([]); setError("Live scores could not be refreshed. Check your connection and retry."); }
      } finally { inFlight = false; if (alive) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [clubId, idsKey, enabled, refresh, scope]);

  const retry = useCallback(() => { setLoading(true); setRefresh((value) => value + 1); }, []);
  // Never retain another scope's score cards while its next request loads.
  return <section className="rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.09),transparent_24rem),rgba(15,23,42,.65)] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="cb-kicker !text-emerald-300">Watchboard</p><h2 className="mt-2 text-2xl font-black">Live now</h2><p className="mt-2 text-xs leading-5 text-slate-400">Public matches with linked player profiles. Refreshes every 30 seconds while this page is visible.</p></div><button type="button" onClick={retry} disabled={loading || !enabled} className="min-h-11 rounded-xl border border-white/15 px-4 text-xs font-black text-emerald-200 disabled:opacity-50">{loading && enabled ? "Loading…" : "Refresh"}</button></div>
    {error ? <p role="alert" className="mt-5 text-sm text-amber-300">{error}</p> : null}
    {!enabled || loading || (!error && loadedScope !== scope) ? <p className="mt-6 text-sm text-slate-400">Loading your watchboard…</p> : matches.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{matches.map((match) => <Link key={liveMatchKey(match)} href={liveMatchHref(match)} className="block rounded-2xl border border-emerald-300/15 bg-slate-950/60 p-4 hover:border-emerald-300/40">
      <div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-xs font-bold text-slate-400">{match.event_name}</p><span className="shrink-0 text-[0.65rem] font-black uppercase tracking-wider text-emerald-300">● Live</span></div>
      <div className="mt-4 space-y-2">{[[match.player1, match.score1], [match.player2, match.score2]].map(([name, score], index) => <div key={index} className="flex items-center justify-between gap-4"><span className="min-w-0 break-words text-sm font-black">{name}</span><span className="text-xl font-black tabular-nums text-cyan-200">{score ?? "–"}</span></div>)}</div>
      <p className="mt-4 text-xs text-slate-500">{match.table_name || "Table not published"}<span className="float-right font-black text-emerald-300">Open match →</span></p>
    </Link>)}</div> : !error ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6"><p className="font-black text-slate-300">No linked players are live right now</p><p className="mt-2 text-sm leading-6 text-slate-500">{clubId ? "Matches appear when an organizer starts a public tournament match, or marks a linked league match as playing on a table." : "Follow public players to see their ongoing matches here. Turn on match alerts to hear when their next match starts."}</p></div> : null}
    {checkedAt && !error && enabled ? <p className="mt-4 text-[0.65rem] text-slate-500">Last checked {checkedAt} · Up to 100 current matches · Scores depend on organizer cloud sync.</p> : null}
  </section>;
}
