"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  validateClubAnnouncement,
  type ClubAnnouncementKind,
  type ClubAnnouncementRow,
} from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage club announcements.");
  return { supabase };
}

export async function createClubAnnouncement(input: {
  clubId: string;
  kind: ClubAnnouncementKind;
  title: string;
  body: string;
  isPinned: boolean;
}) {
  const validation = validateClubAnnouncement(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("club_announcements")
    .insert({
      club_id: input.clubId,
      ...validation.value,
      is_pinned: input.isPinned,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubAnnouncementRow;
}

export async function updateClubAnnouncement(
  id: string,
  updates: Partial<Pick<ClubAnnouncementRow, "kind" | "title" | "body" | "is_pinned">>,
) {
  const { supabase } = await requireUser();
  const safe = { ...updates };
  if (safe.title !== undefined) safe.title = safe.title.trim().replace(/\s+/g, " ");
  if (safe.body !== undefined) safe.body = safe.body.trim();
  const { data, error } = await supabase
    .from("club_announcements")
    .update(safe)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubAnnouncementRow;
}

export async function deleteClubAnnouncement(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("club_announcements").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToClubAnnouncements(clubId: string, callback: () => void) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = supabase
    .channel(`club-announcements-${clubId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "club_announcements", filter: `club_id=eq.${clubId}` },
      callback,
    )
    .subscribe();
  return () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
