"use client";

import {
  validateClubChallenge,
  type ClubChallengeGame,
  type ClubChallengeRow,
  type ClubChallengeSkill,
} from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to use the practice board.");
  return { supabase };
}

export async function createClubChallenge(input: {
  clubId: string;
  title: string;
  message: string;
  gameType: ClubChallengeGame;
  skillLevel: ClubChallengeSkill;
  raceTo?: number | null;
  preferredAt?: string | null;
  venue: string;
  expiresAt: string;
}) {
  const validation = validateClubChallenge(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { value } = validation;
  const { data, error } = await supabase.from("club_challenges").insert({
    club_id: input.clubId,
    title: value.title,
    message: value.message,
    game_type: value.gameType,
    skill_level: value.skillLevel,
    race_to: value.raceTo,
    preferred_at: value.preferredAt?.toISOString() ?? null,
    venue: value.venue,
    expires_at: value.expiresAt.toISOString(),
  }).select("*").single();
  if (error) throw error;
  return data as ClubChallengeRow;
}

export async function respondToClubChallenge(id: string, action: "accept" | "reopen" | "close" | "open") {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("respond_to_club_challenge", {
    target_challenge: id,
    requested_action: action,
  });
  if (error) throw error;
  return data as ClubChallengeRow;
}
