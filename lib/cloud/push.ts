"use client";
import { createClient } from "@/lib/supabase/client";

export async function pushAction<T>(action: string, details: Record<string, unknown> = {}): Promise<T> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in again to manage phone alerts.");
  const { data, error } = await supabase.functions.invoke("push-notifications", { body: { action, ...details } });
  if (error) {
    const context = (error as { context?: Response }).context;
    const message = context instanceof Response ? await context.json().catch(() => null) : null;
    throw new Error(typeof message?.error === "string" ? message.error : "Phone alerts are temporarily unavailable. Your inbox still works.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
