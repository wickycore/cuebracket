"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tournament } from "@/lib/tournaments";
import { syncTournamentToCloud } from "@/lib/cloud/tournaments";

export type CollaborationStatus = "pending" | "accepted" | "declined";

export interface TournamentCollaboratorRow {
  id: string;
  tournament_id: string;
  user_id: string;
  invited_by: string;
  role: "co_organizer";
  status: CollaborationStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
}

export interface TournamentCollaboratorView extends TournamentCollaboratorRow {
  displayName: string;
  username: string | null;
  tournamentName: string | null;
  tournamentTitle?: string;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage co-organizers.");
  return { supabase, user };
}

async function addProfiles(rows: TournamentCollaboratorRow[]) {
  if (!rows.length) return [] as TournamentCollaboratorView[];
  const { supabase } = await requireUser();
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, tournament_name")
    .in("id", userIds);
  if (error) throw error;
  const profiles = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      ...row,
      displayName: profile?.display_name ?? "CueBracket user",
      username: profile?.username ?? null,
      tournamentName: profile?.tournament_name ?? null,
    };
  });
}

export async function getTournamentCollaborators(tournamentId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tournament_collaborators")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at");
  if (error) throw error;
  return addProfiles((data ?? []) as TournamentCollaboratorRow[]);
}

export async function getMyCollaborationInvites() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("tournament_collaborators")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as TournamentCollaboratorRow[];
  if (!rows.length) return [] as TournamentCollaboratorView[];

  const { data: tournaments, error: tournamentError } = await supabase
    .from("cloud_tournaments")
    .select("id, name")
    .in("id", rows.map((row) => row.tournament_id));
  if (tournamentError) throw tournamentError;
  const titles = new Map((tournaments ?? []).map((row) => [row.id, row.name]));
  const withProfiles = await addProfiles(rows);
  return withProfiles.map((row) => ({
    ...row,
    tournamentTitle: titles.get(row.tournament_id) ?? "Tournament",
  }));
}

export async function inviteTournamentCoOrganizer(
  tournament: Tournament,
  username: string,
) {
  const { supabase } = await requireUser();
  await syncTournamentToCloud(tournament);
  const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
    throw new Error("Enter the player’s exact CueBracket username.");
  }
  const { data, error } = await supabase.rpc("invite_tournament_co_organizer", {
    target_tournament_id: tournament.id,
    target_username: cleanUsername,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("That player already has an invitation for this tournament.");
    }
    throw error;
  }
  return data as TournamentCollaboratorRow;
}

export async function respondToCollaborationInvite(
  invitationId: string,
  status: Extract<CollaborationStatus, "accepted" | "declined">,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tournament_collaborators")
    .update({ status })
    .eq("id", invitationId)
    .select("*")
    .single();
  if (error) throw error;
  window.dispatchEvent(new Event("cuebracket:collaborations-changed"));
  return data as TournamentCollaboratorRow;
}

export async function removeTournamentCollaborator(invitationId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tournament_collaborators")
    .delete()
    .eq("id", invitationId);
  if (error) throw error;
  window.dispatchEvent(new Event("cuebracket:collaborations-changed"));
}

export async function getTournamentAccessRole(tournamentId: string) {
  const { supabase, user } = await requireUser();
  const { data: tournament, error } = await supabase
    .from("cloud_tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  // A local-only tournament has no cloud row yet; the signed-in user becomes
  // its owner when the first invitation safely creates the backup.
  if (!tournament) return "owner" as const;
  if (tournament.owner_id === user.id) return "owner" as const;

  const { data: collaboration, error: collaborationError } = await supabase
    .from("tournament_collaborators")
    .select("status")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (collaborationError) throw collaborationError;
  return collaboration ? "co_organizer" as const : null;
}
