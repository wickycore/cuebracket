"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    const { url, key } = getSupabaseEnv();

    client = createBrowserClient(url, key);
  }

  return client;
}
