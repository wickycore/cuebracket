"use client";

import { createClient } from "@/lib/supabase/client";

export type PlayerProfileClaimStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface PlayerProfileClaimRow {
  id: string;
  tournament_id: string;
  registration_id: string;
  claimant_id: string;
  participant_name: string;
  claimant_name: string;
  claimant_username: string | null;
  status: PlayerProfileClaimStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to claim a tournament entry.");
  return { supabase, user };
}

export async function submitPlayerProfileClaim(tournamentId: string, registrationId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("player_profile_claims").insert({
    tournament_id: tournamentId,
    registration_id: registrationId,
    claimant_id: user.id,
    participant_name: "Pending verification",
    claimant_name: "CueBracket player",
  }).select("*").single();
  if (error) throw error;
  return data as PlayerProfileClaimRow;
}

export async function getOrganizerProfileClaims(tournamentId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("player_profile_claims")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlayerProfileClaimRow[];
}

export async function reviewPlayerProfileClaim(id: string, status: "approved" | "rejected") {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("player_profile_claims")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw error;
  return data as PlayerProfileClaimRow;
}

