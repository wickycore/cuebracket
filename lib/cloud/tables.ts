"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type VenueTableStatus = "available" | "playing" | "reserved";
export type VenueEventType = "tournament" | "league";

export interface VenueTableRow {
  id: number;
  owner_id: string;
  club_id: string | null;
  name: string;
  status: VenueTableStatus;
  note: string;
  sort_order: number;
  active_event_type: VenueEventType | null;
  active_event_id: string | null;
  active_match_id: string | null;
  active_match_label: string;
  created_at: string;
  updated_at: string;
}

export interface VenueEventScope {
  id: string;
  clubId: string | null;
  type: VenueEventType;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage venue tables.");
  return { supabase, user };
}

export async function getManagedVenueTables() {
  const { supabase, user } = await requireUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);
  if (membershipError) throw membershipError;
  const clubIds = (memberships ?? []).map((row) => row.club_id);
  const filters = [`owner_id.eq.${user.id}`];
  if (clubIds.length) filters.push(`club_id.in.(${clubIds.join(",")})`);
  const { data, error } = await supabase
    .from("venue_tables")
    .select("*")
    .or(filters.join(","))
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as VenueTableRow[];
}

export async function getEventVenueTables(scope: VenueEventScope) {
  const { supabase, user } = await requireUser();
  if (scope.clubId) {
    const { data, error } = await supabase
      .from("venue_tables")
      .select("*")
      .eq("club_id", scope.clubId)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return (data ?? []) as VenueTableRow[];
  }

  const sourceTable = scope.type === "tournament" ? "cloud_tournaments" : "cloud_leagues";
  const { data: cloudEvent, error: eventError } = await supabase
    .from(sourceTable)
    .select("owner_id")
    .eq("id", scope.id)
    .maybeSingle();
  if (eventError) throw eventError;
  const ownerId = cloudEvent?.owner_id ?? user.id;
  const { data, error } = await supabase
    .from("venue_tables")
    .select("*")
    .eq("owner_id", ownerId)
    .is("club_id", null)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as VenueTableRow[];
}

export async function createVenueTable(input: { clubId: string | null; name: string; note?: string; sortOrder?: number }) {
  const { supabase } = await requireUser();
  const name = input.name.trim();
  if (!name || name.length > 50) throw new Error("Table name must contain 1–50 characters.");
  const { data, error } = await supabase.from("venue_tables").insert({
    club_id: input.clubId,
    name,
    note: input.note?.trim() ?? "",
    sort_order: Math.max(0, input.sortOrder ?? 0),
  }).select("*").single();
  if (error?.code === "23505") throw new Error("That venue already has a table with this name.");
  if (error) throw error;
  return data as VenueTableRow;
}

export async function updateVenueTable(id: number, updates: Partial<Pick<VenueTableRow, "name" | "status" | "note" | "sort_order">>) {
  const { supabase } = await requireUser();
  const safe = { ...updates };
  if (safe.name !== undefined) safe.name = safe.name.trim();
  if (safe.note !== undefined) safe.note = safe.note.trim();
  const { data, error } = await supabase.from("venue_tables").update(safe).eq("id", id).select("*").single();
  if (error?.code === "23505") throw new Error("That venue already has a table with this name.");
  if (error) throw error;
  return data as VenueTableRow;
}

export async function deleteVenueTable(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("venue_tables").delete().eq("id", id);
  if (error) throw error;
}

export async function assignVenueTable(input: {
  tableId: number;
  scope: VenueEventScope;
  matchId: string;
  matchLabel: string;
  status: Extract<VenueTableStatus, "playing" | "reserved">;
}) {
  const { supabase } = await requireUser();
  const { data: current, error: lookupError } = await supabase
    .from("venue_tables")
    .select("*")
    .eq("id", input.tableId)
    .single();
  if (lookupError) throw lookupError;
  const table = current as VenueTableRow;
  if (table.active_match_id && table.active_match_id !== input.matchId) {
    throw new Error(`${table.name} is already assigned to ${table.active_match_label || "another match"}.`);
  }
  const { data, error } = await supabase.from("venue_tables").update({
    status: input.status,
    active_event_type: input.scope.type,
    active_event_id: input.scope.id,
    active_match_id: input.matchId,
    active_match_label: input.matchLabel,
  }).eq("id", input.tableId)
    .or(`active_match_id.is.null,active_match_id.eq.${input.matchId}`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${table.name} was assigned to another match before this request completed.`);
  return data as VenueTableRow;
}

export async function releaseVenueTable(input: { tableId: number; scope: VenueEventScope; matchId: string }) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("venue_tables").update({
    status: "available",
    active_event_type: null,
    active_event_id: null,
    active_match_id: null,
    active_match_label: "",
  }).eq("id", input.tableId)
    .eq("active_event_type", input.scope.type)
    .eq("active_event_id", input.scope.id)
    .eq("active_match_id", input.matchId);
  if (error) throw error;
}

export function subscribeToVenueTables(callback: () => void) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = supabase.channel(`venue-tables-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "venue_tables" }, callback)
    .subscribe();
  return () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
