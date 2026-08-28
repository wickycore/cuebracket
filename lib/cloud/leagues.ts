"use client";

import { createClient } from "@/lib/supabase/client";
import { normalizeLeague, type League } from "@/lib/leagues";

export interface CloudLeagueRow {
  id: string;
  owner_id: string;
  club_id: string | null;
  name: string;
  season: string;
  payload: League;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in before syncing leagues.");
  return { supabase, user };
}

export function rowToLeague(row: CloudLeagueRow) {
  return normalizeLeague({
    ...row.payload,
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    season: row.season,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function syncLeagueToCloud(league: League) {
  const { supabase, user } = await requireUser();
  const payload = {
    club_id: league.clubId,
    name: league.name,
    season: league.season,
    payload: league,
    updated_at: league.updatedAt,
  };
  const { data: existing, error: lookupError } = await supabase
    .from("cloud_leagues")
    .select("id")
    .eq("id", league.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { data, error } = await supabase.from("cloud_leagues").update(payload).eq("id", league.id).select("*").single();
    if (error) throw error;
    return data as CloudLeagueRow;
  }
  const { data, error } = await supabase.from("cloud_leagues").insert({
    id: league.id,
    owner_id: user.id,
    is_public: true,
    created_at: league.createdAt,
    ...payload,
  }).select("*").single();
  if (error) throw error;
  return data as CloudLeagueRow;
}

export async function deleteCloudLeague(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cloud_leagues").delete().eq("id", id);
  if (error) throw error;
}

export async function getMyCloudLeagues() {
  const { supabase, user } = await requireUser();
  const { data: memberships, error: memberError } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);
  if (memberError) throw memberError;
  const clubIds = (memberships ?? []).map((row) => row.club_id);
  const [ownedResult, clubResult] = await Promise.all([
    supabase.from("cloud_leagues").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    clubIds.length
      ? supabase.from("cloud_leagues").select("*").in("club_id", clubIds).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ownedResult.error) throw ownedResult.error;
  if (clubResult.error) throw clubResult.error;
  const byId = new Map<string, CloudLeagueRow>();
  [...(ownedResult.data ?? []), ...(clubResult.data ?? [])].forEach((row) => byId.set(row.id, row as CloudLeagueRow));
  return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getPublicCloudLeague(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("cloud_leagues").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CloudLeagueRow | null;
}

export interface RegisteredPlayerProfile {
  id: string;
  display_name: string;
  tournament_name: string | null;
  username: string | null;
}

export async function findRegisteredPlayer(username: string) {
  const clean = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(clean)) throw new Error("Enter an exact CueBracket username.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, tournament_name, username")
    .ilike("username", clean)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No registered player uses that username.");
  return data as RegisteredPlayerProfile;
}

export async function getClubLeagueRoster(clubId: string) {
  const supabase = createClient();
  const { data: members, error: memberError } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId);
  if (memberError) throw memberError;
  const ids = (members ?? []).map((row) => row.user_id);
  if (!ids.length) return [] as RegisteredPlayerProfile[];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, tournament_name, username")
    .in("id", ids)
    .order("tournament_name");
  if (error) throw error;
  return (data ?? []) as RegisteredPlayerProfile[];
}
