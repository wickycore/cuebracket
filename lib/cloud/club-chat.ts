"use client";

import { createClient } from "@/lib/supabase/client";
import type { ClubChatMessageRow } from "@/lib/club-command-center";

export async function sendClubChatMessage(clubId: string, body: string, extra: Partial<Pick<ClubChatMessageRow, "attachment_path" | "attachment_name" | "attachment_type" | "attachment_size" | "sticker">> = {}) {
  const text = body.trim().replace(/\s+/g, " ");
  if ((!text && !extra.attachment_path && !extra.sticker) || text.length > 1000) throw new Error("Add a message, attachment or sticker.");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to chat with your club.");
  const { data, error } = await supabase.from("club_chat_messages").insert({ club_id: clubId, body: text, ...extra }).select("*").single();
  if (error) throw new Error(error.message);
  return data as ClubChatMessageRow;
}

export async function uploadClubChatFile(clubId: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a file smaller than 10 MB.");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload a file.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
  const path = `${clubId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("club-chat").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return { attachment_path: path, attachment_name: file.name, attachment_type: file.type, attachment_size: file.size };
}

export async function getClubChatFileUrl(path: string) {
  const { data, error } = await createClient().storage.from("club-chat").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteClubChatMessage(id: string, attachmentPath?: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("club_chat_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (attachmentPath) await supabase.storage.from("club-chat").remove([attachmentPath]);
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
