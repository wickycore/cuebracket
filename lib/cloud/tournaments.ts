"use client";

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_TOURNAMENT_OPTIONS, type Tournament } from "@/lib/tournaments";

export class CloudTournamentOwnershipError extends Error {
  constructor(message = "This tournament belongs to another organizer account.") {
    super(message);
    this.name = "CloudTournamentOwnershipError";
  }
}

function isOwnershipConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    value.code === "42501" ||
    value.code === "PGRST116" ||
    value.message?.toLowerCase().includes("row-level security") === true
  );
}

export interface CloudTournamentRow {
  id: string;
  owner_id: string;
  club_id: string | null;
  name: string;
  venue: string;
  stage_type?: "single_stage" | "two_stage";
  format: Tournament["format"];
  race_to: number;
  bracket_size: number;
  status: "draft" | "live" | "completed";
  players: string[];
  options?: Tournament["options"] | null;
  bracket: Tournament["bracket"] | null;
  competition?: Tournament["competition"] | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToTournament(row: CloudTournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    type: row.stage_type ?? "single_stage",
    format: row.format,
    raceTo: row.race_to,
    bracketSize: row.bracket_size,
    status: row.status,
    players: row.players ?? [],
    options: { ...DEFAULT_TOURNAMENT_OPTIONS, ...(row.options ?? {}) },
    bracket: row.bracket ?? undefined,
    competition: row.competition ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tournamentPayload(tournament: Tournament) {
  return {
    name: tournament.name,
    venue: tournament.venue,
    stage_type: tournament.type,
    format: tournament.format,
    race_to: tournament.raceTo,
    bracket_size: tournament.bracketSize,
    status: tournament.status,
    players: tournament.players,
    options: tournament.options,
    bracket: tournament.bracket ?? null,
    competition: tournament.competition ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Sign in before syncing tournaments.");

  return { supabase, user };
}

export async function syncTournamentToCloud(
  tournament: Tournament,
): Promise<CloudTournamentRow> {
  const { supabase, user } = await requireUser();

  const { data: existing, error: lookupError } = await supabase
    .from("cloud_tournaments")
    .select("id, owner_id, club_id")
    .eq("id", tournament.id)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (
    existing &&
    existing.owner_id !== user.id &&
    existing.club_id === null
  ) {
    throw new CloudTournamentOwnershipError();
  }

  if (existing) {
    const { data, error } = await supabase
      .from("cloud_tournaments")
      .update(tournamentPayload(tournament))
      .eq("id", tournament.id)
      .select("*")
      .single();

    if (error) {
      if (isOwnershipConflict(error)) throw new CloudTournamentOwnershipError();
      throw error;
    }
    return data as CloudTournamentRow;
  }

  const { data, error } = await supabase
    .from("cloud_tournaments")
    .insert({
      id: tournament.id,
      owner_id: user.id,
      created_at: tournament.createdAt,
      is_public: false,
      ...tournamentPayload(tournament),
    })
    .select("*")
    .single();

  if (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    // Two devices can create the same local tournament at almost the same time.
    // If another request won that race, inspect the row and safely update it.
    if (errorCode === "23505") {
      const { data: racedRow, error: racedLookupError } = await supabase
        .from("cloud_tournaments")
        .select("id, owner_id, club_id")
        .eq("id", tournament.id)
        .maybeSingle();

      if (racedLookupError) throw racedLookupError;
      if (
        !racedRow ||
        (racedRow.owner_id !== user.id && racedRow.club_id === null)
      ) {
        throw new CloudTournamentOwnershipError();
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from("cloud_tournaments")
        .update(tournamentPayload(tournament))
        .eq("id", tournament.id)
        .select("*")
        .single();

      if (updateError) {
        if (isOwnershipConflict(updateError)) {
          throw new CloudTournamentOwnershipError();
        }
        throw updateError;
      }

      return updatedRow as CloudTournamentRow;
    }

    if (isOwnershipConflict(error)) throw new CloudTournamentOwnershipError();
    throw error;
  }
  return data as CloudTournamentRow;
}

export async function deleteCloudTournament(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("cloud_tournaments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function setCloudTournamentVisibility(
  id: string,
  isPublic: boolean,
): Promise<CloudTournamentRow> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("cloud_tournaments")
    .update({
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as CloudTournamentRow;
}

export async function getMyCloudTournaments() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("cloud_tournaments")
    .select("*")
    .eq("owner_id", user.id)
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
