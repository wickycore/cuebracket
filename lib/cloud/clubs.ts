"use client";

import { createClient } from "@/lib/supabase/client";
import {
  validateClubDetails,
  type ClubMembershipRequestRow,
  type ClubMemberRow,
  type ClubRole,
  type ClubRow,
  type MembershipRequestStatus,
} from "@/lib/clubs";

async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to manage clubs.");
  return { supabase, user };
}

export async function createClub(input: {
  name: string;
  slug: string;
  location: string;
  description: string;
}) {
  const validation = validateClubDetails(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clubs")
    .insert({
      owner_id: user.id,
      ...validation.value,
      is_public: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubRow;
}

export async function getManagedClubs() {
  const { supabase, user } = await requireUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("club_members")
    .select("club_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((item) => item.club_id);
  if (!ids.length) return [] as ClubRow[];
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .in("id", ids)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClubRow[];
}

export async function followClub(clubId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("club_followers")
    .insert({ club_id: clubId, user_id: user.id });
  if (error) throw error;
}

export async function unfollowClub(clubId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("club_followers")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function requestClubMembership(clubId: string, requestName: string) {
  const cleanName = requestName.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 50) {
    throw new Error("Your request name must be between 2 and 50 characters.");
  }
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("club_membership_requests")
    .insert({
      club_id: clubId,
      user_id: user.id,
      request_name: cleanName,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubMembershipRequestRow;
}

export async function withdrawMembershipRequest(requestId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("club_membership_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubMembershipRequestRow;
}

export async function updateMembershipRequest(
  requestId: string,
  status: Extract<MembershipRequestStatus, "approved" | "rejected">,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("club_membership_requests")
    .update({ status })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubMembershipRequestRow;
}

export async function updateClub(
  clubId: string,
  input: { name: string; slug: string; location: string; description: string },
) {
  const validation = validateClubDetails(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("clubs")
    .update({ ...validation.value, updated_at: new Date().toISOString() })
    .eq("id", clubId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubRow;
}

export async function updateClubMemberRole(
  clubId: string,
  userId: string,
  role: Extract<ClubRole, "admin" | "member">,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("club_members")
    .update({ role })
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubMemberRow;
}

export async function removeClubMember(clubId: string, userId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId);
  if (error) throw error;
}
