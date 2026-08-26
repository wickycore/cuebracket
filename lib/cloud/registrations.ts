"use client";

import { createClient } from "@/lib/supabase/client";
import { syncTournamentToCloud } from "@/lib/cloud/tournaments";
import type { RegistrationStatus } from "@/lib/registration";
import type { Tournament } from "@/lib/tournaments";

export interface RegistrationSettingsRow {
  tournament_id: string;
  owner_id: string;
  club_id: string | null;
  event_name: string;
  venue: string;
  format: string;
  race_to: number;
  capacity: number;
  scheduled_at: string | null;
  entry_fee: string;
  notes: string;
  registration_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRegistrationRow {
  id: string;
  tournament_id: string;
  profile_id: string | null;
  display_name: string;
  status: RegistrationStatus;
  source: "self" | "organizer";
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage tournament registration.");
  return { supabase, user };
}

export async function getRegistrationSettings(tournamentId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("event_registration_settings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  return data as RegistrationSettingsRow | null;
}

export async function saveRegistrationSettings(
  tournament: Tournament,
  input: { scheduledAt: string | null; entryFee: string; notes: string; registrationOpen: boolean },
) {
  const { supabase, user } = await requireUser();
  await syncTournamentToCloud(tournament);

  const { data, error } = await supabase
    .from("event_registration_settings")
    .upsert({
      tournament_id: tournament.id,
      owner_id: user.id,
      club_id: tournament.clubId ?? null,
      event_name: tournament.name,
      venue: tournament.venue,
      format: tournament.format,
      race_to: tournament.raceTo,
      capacity: tournament.bracketSize,
      scheduled_at: input.scheduledAt,
      entry_fee: input.entryFee.trim(),
      notes: input.notes.trim(),
      registration_open: input.registrationOpen,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tournament_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as RegistrationSettingsRow;
}

export async function getOrganizerRegistrations(tournamentId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRegistrationRow[];
}

export async function changeRegistrationStatus(
  id: string,
  status: RegistrationStatus,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("event_registrations")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as EventRegistrationRow;
}

export async function removeRegistration(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("event_registrations").delete().eq("id", id);
  if (error) throw error;
}
