"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tournament } from "@/lib/tournaments";

export interface CloudTournamentRow {
  id: string;
  owner_id: string;
  club_id: string | null;
  name: string;
  venue: string;
  format: "single" | "double";
  race_to: number;
  bracket_size: number;
  status: "draft" | "live" | "completed";
  players: string[];
  bracket: Tournament["bracket"] | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToTournament(row: CloudTournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    format: row.format,
    raceTo: row.race_to,
    bracketSize: row.bracket_size as Tournament["bracketSize"],
    status: row.status,
    players: row.players ?? [],
    bracket: row.bracket ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function syncTournamentToCloud(tournament: Tournament) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Sign in before syncing tournaments.");

  const { error } = await supabase.from("cloud_tournaments").upsert(
    {
      id: tournament.id,
      owner_id: user.id,
      name: tournament.name,
      venue: tournament.venue,
      format: tournament.format,
      race_to: tournament.raceTo,
      bracket_size: tournament.bracketSize,
      status: tournament.status,
      players: tournament.players,
      bracket: tournament.bracket ?? null,
      is_public: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function getMyCloudTournaments() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cloud_tournaments")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CloudTournamentRow[];
}

export async function getPublicCloudTournament(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cloud_tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as CloudTournamentRow;
}
