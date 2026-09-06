import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicTournamentParticipant {
  displayName: string;
  profileId: string;
  username: string | null;
  avatarUrl: string | null;
}

interface PublicTournamentParticipantRow {
  display_name: string;
  profile_id: string;
  username: string | null;
  avatar_url: string | null;
}

export function normalizeParticipantName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function participantProfilePath(participant: PublicTournamentParticipant) {
  return `/players/${encodeURIComponent(participant.username ?? participant.profileId)}`;
}

export async function loadPublicTournamentParticipants(
  supabase: SupabaseClient,
  tournamentId: string,
) {
  const { data, error } = await supabase
    .from("public_tournament_participants")
    .select("display_name, profile_id, username, avatar_url")
    .eq("tournament_id", tournamentId);

  if (error) throw error;

  return ((data ?? []) as PublicTournamentParticipantRow[]).map((row) => ({
    displayName: row.display_name,
    profileId: row.profile_id,
    username: row.username,
    avatarUrl: row.avatar_url,
  }));
}
