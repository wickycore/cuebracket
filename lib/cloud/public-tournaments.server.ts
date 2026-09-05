import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

import type { CloudTournamentRow } from "@/lib/cloud/tournaments";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type PublicTournamentSnapshot =
  | { state: "ready"; row: CloudTournamentRow }
  | { state: "not_found"; row: null }
  | { state: "unavailable"; row: null };

const PUBLIC_TOURNAMENT_TIMEOUT_MS = 6_000;

function createPublicClient() {
  const { url, key } = getSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const loadPublicTournamentSnapshot = async (
  id: string,
  timeoutMs = PUBLIC_TOURNAMENT_TIMEOUT_MS,
): Promise<PublicTournamentSnapshot> => {
  const supabase = createPublicClient();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      supabase
        .from("cloud_tournaments")
        .select("*")
        .eq("id", id)
        .eq("is_public", true)
        .maybeSingle(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Public tournament request timed out.")),
          timeoutMs,
        );
      }),
    ]);

    if (result.error) return { state: "unavailable", row: null };
    if (!result.data) return { state: "not_found", row: null };
    return { state: "ready", row: result.data as CloudTournamentRow };
  } catch {
    return { state: "unavailable", row: null };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const getPublicTournamentSnapshot = cache(loadPublicTournamentSnapshot);
