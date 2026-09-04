"use client";

import {
  validateClubCalendarEvent,
  type ClubCalendarEventRow,
  type ClubCalendarKind,
  type ClubCalendarRecurrence,
  type ClubCalendarResponse,
  type ClubCalendarRsvpRow,
} from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to use the club calendar.");
  return { supabase, user };
}

export async function createClubCalendarEvent(input: {
  clubId: string;
  title: string;
  kind: ClubCalendarKind;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  capacity?: number | null;
  recurrence?: ClubCalendarRecurrence;
  recurrenceCount?: number;
}) {
  const validation = validateClubCalendarEvent(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { value } = validation;
  const seriesId = value.recurrence === "weekly" ? crypto.randomUUID() : null;
  const duration = value.endsAt ? value.endsAt.getTime() - value.startsAt.getTime() : null;
  const rows = Array.from({ length: value.recurrenceCount }, (_, index) => {
    const occurrenceStart = new Date(value.startsAt.getTime() + index * 7 * 86_400_000);
    return {
      club_id: input.clubId,
      title: value.title,
      kind: value.kind,
      description: value.description,
      starts_at: occurrenceStart.toISOString(),
      ends_at: duration === null ? null : new Date(occurrenceStart.getTime() + duration).toISOString(),
      location: value.location,
      capacity: value.capacity,
      series_id: seriesId,
      recurrence: value.recurrence,
    };
  });
  const { data, error } = await supabase.from("club_calendar_events").insert(rows).select("*").order("starts_at");
  if (error) throw error;
  return data as ClubCalendarEventRow[];
}

export async function setClubCalendarRsvp(eventId: string, response: ClubCalendarResponse | null) {
  const { supabase, user } = await requireUser();
  if (!response) {
    const { error } = await supabase.from("club_calendar_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase.from("club_calendar_rsvps").upsert({
    event_id: eventId,
    user_id: user.id,
    response,
  }, { onConflict: "event_id,user_id" }).select("*").single();
  if (error) throw error;
  return data as ClubCalendarRsvpRow;
}

export async function setClubCalendarEventCancelled(eventId: string, isCancelled: boolean) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("club_calendar_events").update({ is_cancelled: isCancelled }).eq("id", eventId).select("*").single();
  if (error) throw error;
  return data as ClubCalendarEventRow;
}
