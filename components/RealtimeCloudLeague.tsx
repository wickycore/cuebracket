"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { LeagueFixtures } from "@/components/LeagueFixtures";
import { LeaguePlayoffs } from "@/components/LeaguePlayoffs";
import { LeagueStandings } from "@/components/LeagueStandings";
import { getPublicCloudLeague, rowToLeague, type CloudLeagueRow } from "@/lib/cloud/leagues";
import { getLeague, getPlayerName, type League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/client";

export function RealtimeCloudLeague({ id }: { id: string }) {
  const [league, setLeague] = useState<League | null>(() => getLeague(id) ?? null);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void getPublicCloudLeague(id).then((row) => {
      if (!active) return;
      if (row) { setLeague(rowToLeague(row)); setError(""); }
      else if (!getLeague(id)) setError("This league is private, unavailable or has been removed.");
    }).catch(() => { if (active && !getLeague(id)) setError("This league is unavailable."); });
    const channel = supabase.channel(`cloud-league-${id}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cloud_leagues", filter: `id=eq.${id}` },
      (payload: RealtimePostgresChangesPayload<CloudLeagueRow>) => {
        if (!active) return;
        if (payload.eventType === "DELETE") { setLeague(null); setError("This league is no longer available."); return; }
        setLeague(rowToLeague(payload.new as unknown as CloudLeagueRow));
        setError("");
      },
    ).subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") setConnection("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("reconnecting");
    });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [id]);

  if (error) return <p className="rounded-2xl bg-rose-400/10 p-5 font-bold text-rose-300">{error}</p>;
  if (!league) return <p className="animate-pulse text-slate-400">Connecting to the live league...</p>;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${connection === "live" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>● {connection === "live" ? "Realtime" : "Reconnecting"}</span>
            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">{league.season}</span>
          </div>
          <h1 className="mt-3 text-4xl font-black">{league.name}</h1>
          <p className="mt-2 text-slate-400">{league.venue || "Venue not set"} · {league.gameType} · Race to {league.raceTo}</p>
        </div>
        <span className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-black capitalize text-cyan-300">{league.status}</span>
      </div>
      {league.championPlayerId ? <div className="mt-8 rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-6"><p className="text-xs font-black uppercase tracking-wider text-amber-200">Season champion</p><p className="mt-2 text-3xl font-black">🏆 {getPlayerName(league, league.championPlayerId)}</p></div> : null}
      <div className="mt-8 space-y-8">
        <LeagueStandings league={league} />
        <LeagueFixtures league={league} />
        <LeaguePlayoffs league={league} />
      </div>
    </>
  );
}
