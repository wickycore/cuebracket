"use client";

import { validateClubBroadcast, type ClubBroadcastAudience, type ClubBroadcastRow, type ClubBroadcastTemplate } from "@/lib/club-communications";
import { createClient } from "@/lib/supabase/client";

export async function sendClubBroadcast(input: {
  clubId: string;
  audience: ClubBroadcastAudience;
  template: ClubBroadcastTemplate;
  title: string;
  message: string;
}) {
  const checked = validateClubBroadcast(input);
  if (!checked.ok) throw new Error(checked.message);
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to send a club update.");
  const { data, error } = await supabase.rpc("send_club_broadcast", {
    target_club: input.clubId,
    target_audience: checked.value.audience,
    message_template: checked.value.template,
    message_title: checked.value.title,
    message_body: checked.value.message,
  });
  if (error) throw error;
  return data as ClubBroadcastRow;
}
