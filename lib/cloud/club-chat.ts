"use client";

import { createClient } from "@/lib/supabase/client";
import type { ClubChatMessageRow } from "@/lib/club-command-center";

export async function sendClubChatMessage(clubId: string, body: string) {
  const text = body.trim().replace(/\s+/g, " ");
  if (!text || text.length > 1000) throw new Error("Write a message between 1 and 1000 characters.");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to chat with your club.");
  const { data, error } = await supabase.from("club_chat_messages").insert({ club_id: clubId, body: text }).select("*").single();
  if (error) throw new Error(error.message);
  return data as ClubChatMessageRow;
}

export async function deleteClubChatMessage(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("club_chat_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function subscribeToClubChat(clubId: string, refresh: () => void) {
  const supabase = createClient();
  const channel = supabase.channel(`club-chat-${clubId}-${crypto.randomUUID()}`).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "club_chat_messages", filter: `club_id=eq.${clubId}` },
    refresh,
  ).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function loadClubChatMessages(clubId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("club_chat_messages").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).reverse() as ClubChatMessageRow[];
}
