"use client";

import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaPathFromUrl } from "@/lib/cloud/media";
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

export async function requestClubMembership(clubId: string, requestName: string, acceptedGuideRevision: number) {
  const cleanName = requestName.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 50) {
    throw new Error("Your request name must be between 2 and 50 characters.");
  }
  if (!Number.isInteger(acceptedGuideRevision) || acceptedGuideRevision < 1) {
    throw new Error("Read and accept the latest club guide before joining.");
  }
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("club_membership_requests")
    .insert({
      club_id: clubId,
      user_id: user.id,
      request_name: cleanName,
      accepted_guide_revision: acceptedGuideRevision,
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
  input: { name: string; slug: string; location: string; description: string; logoUrl?: string | null },
) {
  const validation = validateClubDetails(input);
  if (!validation.ok) throw new Error(validation.message);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("clubs")
    .update({
      ...validation.value,
      ...(input.logoUrl === undefined ? {} : { logo_url: input.logoUrl }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubRow;
}

export async function updateClubLocation(clubId: string, location: string) {
  const cleanLocation = location.trim().replace(/\s+/g, " ");
  if (!cleanLocation || cleanLocation.length > 100) {
    throw new Error("Add a club location using 100 characters or fewer.");
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("clubs")
    .update({ location: cleanLocation, updated_at: new Date().toISOString() })
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
  const { supabase, user } = await requireUser();
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("owner_id")
    .eq("id", clubId)
    .single();
  if (clubError) throw clubError;
  if (club.owner_id !== user.id) {
    throw new Error("Only the club owner can assign or remove admin access.");
  }
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
  const { data, error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Only the club owner can remove an admin.");
}

export async function deleteClub(clubId: string) {
  const { supabase, user } = await requireUser();
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, owner_id, logo_url")
    .eq("id", clubId)
    .single();
  if (clubError) throw clubError;
  if (club.owner_id !== user.id) throw new Error("Only the club owner can delete this club.");

  const [galleryResult, achievementResult] = await Promise.all([
    supabase.from("club_gallery_items").select("image_url").eq("club_id", clubId),
    supabase.from("club_achievements").select("image_url").eq("club_id", clubId),
  ]);
  if (galleryResult.error || achievementResult.error) {
    throw new Error("The club media could not be checked. Nothing was deleted.");
  }

  const clubFolder = `clubs/${clubId}/`;
  const mediaPaths = [...new Set([
    mediaPathFromUrl(club.logo_url),
    ...(galleryResult.data ?? []).map((item) => mediaPathFromUrl(item.image_url)),
    ...(achievementResult.data ?? []).map((item) => mediaPathFromUrl(item.image_url)),
  ].filter((path): path is string => Boolean(path?.startsWith(clubFolder))))];

  if (mediaPaths.length) {
    const { error: mediaError } = await supabase.storage.from(MEDIA_BUCKET).remove(mediaPaths);
    if (mediaError) throw new Error("The club images could not be removed. Nothing else was deleted.");
  }

  const { data, error } = await supabase
    .from("clubs")
    .delete()
    .eq("id", clubId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The club was not deleted. Only its owner can complete this action.");
}
