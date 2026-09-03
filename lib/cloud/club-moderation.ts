"use client";

import {
  validateClubReport,
  type ClubMemberBlockRow,
  type ClubMemberReportRow,
  type ClubMemberRestrictionRow,
  type ClubReportCategory,
  type ClubReportStatus,
} from "@/lib/club-command-center";
import { createClient } from "@/lib/supabase/client";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to use club safety tools.");
  return { supabase, user };
}

export async function reportClubMember(input: { clubId: string; reportedUserId: string; reportedName: string; category: ClubReportCategory; details: string }) {
  const validation = validateClubReport(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("club_member_reports").insert({
    club_id: input.clubId,
    reporter_id: user.id,
    reported_user_id: input.reportedUserId,
    reported_name: input.reportedName,
    category: validation.value.category,
    details: validation.value.details,
  }).select("*").single();
  if (error) throw error;
  return data as ClubMemberReportRow;
}

export async function reviewClubReport(id: string, status: Exclude<ClubReportStatus, "open">) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("club_member_reports")
    .update({ status, reviewed_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id).select("*").single();
  if (error) throw error;
  return data as ClubMemberReportRow;
}

export async function setClubMemberRestriction(input: { clubId: string; userId: string; isSuspended: boolean; isMuted: boolean; reason: string }) {
  const { supabase, user } = await requireUser();
  if (!input.isSuspended && !input.isMuted) {
    const { error } = await supabase.from("club_member_restrictions").delete().eq("club_id", input.clubId).eq("user_id", input.userId);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase.from("club_member_restrictions").upsert({
    club_id: input.clubId,
    user_id: input.userId,
    is_suspended: input.isSuspended,
    is_muted: input.isMuted,
    reason: input.reason.trim().slice(0, 500),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (error) throw error;
  return data as ClubMemberRestrictionRow;
}

export async function blockClubMember(input: { clubId: string; userId: string; userName: string; reason: string }) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("block_club_member", {
    target_club: input.clubId,
    target_user: input.userId,
    target_name: input.userName,
    block_reason: input.reason.trim().slice(0, 500),
  });
  if (error) throw error;
}

export async function unblockClubMember(clubId: string, userId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("club_member_blocks").delete().eq("club_id", clubId).eq("user_id", userId);
  if (error) throw error;
}

export type { ClubMemberBlockRow, ClubMemberReportRow, ClubMemberRestrictionRow };
