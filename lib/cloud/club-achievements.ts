"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  validateClubAchievement,
  type ClubAchievementKind,
  type ClubAchievementRow,
} from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage club honours.");
  return { supabase };
}

export async function createClubAchievement(input: {
  clubId: string;
  recipientId: string;
  kind: ClubAchievementKind;
  title: string;
  description: string;
  awardedOn: string;
  isFeatured: boolean;
  imageUrl?: string | null;
}) {
  const validation = validateClubAchievement(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { value } = validation;
  const { data, error } = await supabase.from("club_achievements").insert({
    club_id: input.clubId,
    recipient_id: value.recipientId,
    kind: value.kind,
    title: value.title,
    description: value.description,
    awarded_on: value.awardedOn,
    is_featured: value.isFeatured,
    image_url: input.imageUrl ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as ClubAchievementRow;
}

export async function setClubAchievementFeatured(id: string, isFeatured: boolean) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("club_achievements")
    .update({ is_featured: isFeatured })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubAchievementRow;
}

export async function deleteClubAchievement(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("club_achievements").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToClubAchievements(clubId: string, callback: () => void) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = supabase
    .channel(`club-achievements-${clubId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "club_achievements", filter: `club_id=eq.${clubId}` },
      callback,
    )
    .subscribe();
  return () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
