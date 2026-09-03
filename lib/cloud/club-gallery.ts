"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { validateClubGalleryItem, type ClubGalleryItemRow } from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage the club gallery.");
  return { supabase };
}

export async function createClubGalleryItem(input: { clubId: string; imageUrl: string; caption: string; occurredOn: string }) {
  const validation = validateClubGalleryItem(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("club_gallery_items").insert({
    club_id: input.clubId,
    image_url: input.imageUrl,
    caption: validation.value.caption,
    occurred_on: validation.value.occurredOn,
  }).select("*").single();
  if (error) throw error;
  return data as ClubGalleryItemRow;
}

export async function deleteClubGalleryItem(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("club_gallery_items").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToClubGallery(clubId: string, callback: () => void) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = supabase.channel(`club-gallery-${clubId}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "club_gallery_items", filter: `club_id=eq.${clubId}` }, callback)
    .subscribe();
  return () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
