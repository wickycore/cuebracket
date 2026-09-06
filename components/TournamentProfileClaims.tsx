"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getOrganizerProfileClaims, reviewPlayerProfileClaim, type PlayerProfileClaimRow } from "@/lib/cloud/profile-claims";
import { createClient } from "@/lib/supabase/client";

export function TournamentProfileClaims({ tournamentId }: { tournamentId: string }) {
  const [claims, setClaims] = useState<PlayerProfileClaimRow[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setClaims(await getOrganizerProfileClaims(tournamentId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load player claims.");
    }
  }, [tournamentId]);

  useEffect(() => {
    let active = true;
    getOrganizerProfileClaims(tournamentId).then((rows) => {
      if (active) setClaims(rows);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "Unable to load player claims.");
    });
    return () => { active = false; };
  }, [tournamentId]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`profile-claims:${tournamentId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_profile_claims", filter: `tournament_id=eq.${tournamentId}` },
      () => void load(),
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, tournamentId]);

  const pending = useMemo(() => claims.filter((claim) => claim.status === "pending"), [claims]);

  async function review(claim: PlayerProfileClaimRow, status: "approved" | "rejected") {
    setBusyId(claim.id);
    setMessage("");
    try {
      await reviewPlayerProfileClaim(claim.id, status);
      setClaims((current) => current.map((row) => row.id === claim.id ? { ...row, status } : row));
      setMessage(status === "approved"
        ? `${claim.participant_name} is now linked to ${claim.claimant_name}. Their verified results will update automatically.`
        : `${claim.claimant_name}'s request was rejected.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to review this claim.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="border-t border-white/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Player identity</p>
          <h3 className="mt-2 text-xl font-black">Guest profile claims</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Only approve when you recognize the player. CueBracket never joins records just because two names match.</p>
        </div>
        {pending.length ? <span className="rounded-full bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200 ring-1 ring-amber-300/20">{pending.length} waiting</span> : null}
      </div>

      {message ? <p role="status" className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}
      <div className="mt-5 space-y-3">
        {pending.length ? pending.map((claim) => (
          <div key={claim.id} className="flex flex-col gap-3 rounded-2xl border border-violet-300/15 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-black text-white">{claim.claimant_name}{claim.claimant_username ? <span className="ml-2 text-sm text-cyan-300">@{claim.claimant_username}</span> : null}</p>
              <p className="mt-1 text-sm text-slate-300">wants to claim tournament entry <strong>{claim.participant_name}</strong></p>
              <p className="mt-1 text-xs text-slate-400">Requested {new Date(claim.created_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busyId === claim.id} onClick={() => void review(claim, "approved")} className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">Verify & link</button>
              <button type="button" disabled={busyId === claim.id} onClick={() => void review(claim, "rejected")} className="rounded-xl bg-rose-300/10 px-4 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-300/20 disabled:opacity-40">Reject</button>
            </div>
          </div>
        )) : <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-400">No guest profile claims need review.</div>}
      </div>
    </div>
  );
}
