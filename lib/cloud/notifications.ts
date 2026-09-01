"use client";

import type { BracketMatch, Tournament } from "@/lib/tournaments";
import type { NotificationPreferencesRow } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage notifications.");
  return { supabase, user };
}

export async function markNotificationRead(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function saveNotificationPreferences(
  preferences: Pick<NotificationPreferencesRow, "club_events" | "registration_updates" | "match_alerts" | "followed_player_alerts" | "club_messages">,
) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...preferences }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as NotificationPreferencesRow;
}

export async function recordMatchStarted(tournament: Tournament, match: BracketMatch) {
  if (!match.player1 || !match.player2) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("match_activity").insert({
    tournament_id: tournament.id,
    owner_id: user.id,
    match_key: match.id,
    player1: match.player1,
    player2: match.player2,
  });
  if (error && error.code !== "23505") throw error;
}
