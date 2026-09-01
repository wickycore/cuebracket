"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FollowedProfile, PlayerFollow } from "@/lib/player-following";
import { LiveMatchFeed } from "@/components/LiveMatchFeed";

interface FollowingState {
  userId: string | null;
  follows: PlayerFollow[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  change: (playerId: string, action: "follow" | "unfollow" | "mute" | "alerts", profile?: FollowedProfile) => Promise<void>;
}
const FollowingContext = createContext<FollowingState | null>(null);

export function PlayerFollowingProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(createClient);
  const [userId, setUserId] = useState<string | null>(null);
  const [follows, setFollows] = useState<PlayerFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (version !== requestVersion.current) return;
      setLoading(true);
      setError("");
      setUserId(user?.id ?? null);
      if (!user) { setFollows([]); return; }
      const rows: PlayerFollow[] = [];
      for (let from = 0; ; from += 1000) {
        const result = await supabase.from("player_followers")
          .select("player_id,notify_live,player:profiles!player_followers_player_id_fkey(id,username,display_name,tournament_name,avatar_url,is_public)")
          .eq("user_id", user.id).order("created_at").order("player_id").range(from, from + 999);
        if (result.error) throw result.error;
        const batch = result.data as unknown as PlayerFollow[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      if (version === requestVersion.current) setFollows(rows);
    } catch { if (version === requestVersion.current) { setFollows([]); setError("Could not load your following list. Check your connection and retry."); } }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const cancel = () => { requestVersion.current++; };
    // Only identity changes need a reload; token refreshes must not reset controls.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        // Supabase auth calls must run outside its auth-state callback lock.
        window.setTimeout(() => { if (active) void reload(); }, 0);
      }
      if (event === "SIGNED_OUT") { requestVersion.current++; setUserId(null); setFollows([]); setLoading(false); setError(""); }
    });
    return () => { active = false; cancel(); subscription.unsubscribe(); };
  }, [reload, supabase]);

  const change: FollowingState["change"] = async (playerId, action, profile) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) throw new Error("Sign in again to manage following.");
    if (action === "follow") {
      const { error } = await supabase.from("player_followers").insert({ user_id: user.id, player_id: playerId, notify_live: false });
      if (error && error.code !== "23505") throw new Error("This player could not be followed. Their profile must be public.");
      // Read the authoritative value after a possible duplicate from another tab.
      const result = await supabase.from("player_followers").select("notify_live").eq("user_id", user.id).eq("player_id", playerId).single();
      if (result.error) throw new Error("Could not confirm following. Please refresh.");
      setFollows((rows) => [...rows.filter((row) => row.player_id !== playerId), { player_id: playerId, notify_live: result.data.notify_live, player: profile ?? null }]);
    } else {
      const query = action === "unfollow" ? supabase.from("player_followers").delete() : supabase.from("player_followers").update({ notify_live: action === "alerts" });
      const result = await query.eq("user_id", user.id).eq("player_id", playerId).select("player_id");
      if (result.error || !result.data?.length) throw new Error("Could not save this change. Refresh and try again.");
      setFollows((rows) => action === "unfollow" ? rows.filter((row) => row.player_id !== playerId) : rows.map((row) => row.player_id === playerId ? { ...row, notify_live: action === "alerts" } : row));
    }
  };

  return <FollowingContext.Provider value={{ userId, follows, loading, error, reload, change }}>{children}</FollowingContext.Provider>;
}

function useFollowing() {
  const value = useContext(FollowingContext);
  if (!value) throw new Error("Following controls require a provider");
  return value;
}

export function FollowPlayerButton({ playerId, profile }: { playerId: string; profile?: FollowedProfile }) {
  const { userId, follows, loading, error, reload, change } = useFollowing();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const followed = follows.find((row) => row.player_id === playerId);
  if (userId === playerId) return <p className="text-xs text-slate-500">This is your profile</p>;
  if (loading) return <p className="text-xs text-slate-500">Loading follow controls…</p>;
  if (error) return <button type="button" onClick={() => void reload()} className="text-xs text-amber-300">Retry follow controls</button>;
  if (!userId) return <Link href={`/auth/login?next=${encodeURIComponent(profile?.username ? `/players/${profile.username}` : "/following")}`} className="inline-block rounded-xl border border-cyan-300/25 px-3 py-2 text-xs font-black text-cyan-300">Sign in to follow</Link>;
  if (!followed && !profile?.is_public) return null;

  async function run(action: Parameters<FollowingState["change"]>[1]) {
    setBusy(true); setMessage("");
    try { await change(playerId, action, profile); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} aria-label={`${followed ? "Unfollow" : "Follow"} ${profile?.display_name ?? "player"}`} onClick={() => void run(followed ? "unfollow" : "follow")} className={`min-h-11 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50 ${followed ? "border border-white/15 text-slate-300" : "bg-cyan-400 text-slate-950"}`}>{busy ? "Saving…" : followed ? "Following · Unfollow" : "+ Follow player"}</button>
      {followed && profile?.is_public ? <button type="button" disabled={busy} aria-pressed={followed.notify_live} onClick={() => void run(followed.notify_live ? "mute" : "alerts")} className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${followed.notify_live ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-white/15 text-slate-300"}`}>{followed.notify_live ? "Match alerts on" : "Turn on match alerts"}</button> : null}
    </div>
    {message ? <p role="alert" className="text-xs text-amber-300">{message}</p> : null}
  </div>;
}

export function FollowingDashboard() {
  const { follows, loading, error, reload } = useFollowing();
  const playerIds = useMemo(() => follows.filter((row) => row.player?.is_public).map((row) => row.player_id), [follows]);
  const [query, setQuery] = useState("");
  const visible = follows.filter((row) => `${row.player?.display_name ?? "Unavailable profile"} ${row.player?.username ?? ""}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="space-y-7">
    <LiveMatchFeed playerIds={playerIds} enabled={!loading && !error} />
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-black">Your players <span className="text-slate-500">{follows.length}</span></h2><input aria-label="Search followed players" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your players" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm" /></div>
      {loading ? <p className="mt-5 text-slate-400">Loading players…</p> : error ? <div role="alert" className="mt-5 text-amber-300">{error} <button type="button" onClick={() => void reload()} className="underline">Retry</button></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{visible.map(({ player_id, player }) => <article key={player_id} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        {player?.is_public && player.username ? <Link href={`/players/${player.username}`} className="flex items-center gap-3 font-black text-white"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-lg text-cyan-200">{player.avatar_url ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" /> : (player.tournament_name || player.display_name || "P").charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block truncate">{player.tournament_name || player.display_name}</span><span className="mt-1 block text-xs text-slate-500">@{player.username} →</span></span></Link> : <p className="text-sm text-slate-500">Profile unavailable or private. Alerts are paused.</p>}
        <FollowPlayerButton playerId={player_id} profile={player ?? undefined} />
      </article>)}</div>}
      {!loading && !error && !visible.length ? <p className="mt-5 text-sm leading-6 text-slate-400">{follows.length ? "No players match your search." : <>Your watchlist starts here. Open a player’s public profile from <Link href="/clubs" className="text-cyan-300 underline">club members</Link> or <Link href="/rankings" className="text-cyan-300 underline">rankings</Link>, then choose Follow player.</>}</p> : null}
    </section>
  </div>;
}
