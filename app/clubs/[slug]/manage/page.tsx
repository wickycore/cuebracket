import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubAdminWorkspace } from "@/components/ClubAdminWorkspace";
import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubGuideRow, ClubMemberRow, ClubMembershipRequestRow, ClubRole, ClubRow } from "@/lib/clubs";
import type {
  ClubAchievementRow,
  ClubAnnouncementRow,
  ClubCalendarEventRow,
  ClubCalendarRsvpRow,
  ClubChallengeRow,
  ClubGalleryItemRow,
  ClubMemberBlockRow,
  ClubMemberReportRow,
  ClubMemberRestrictionRow,
} from "@/lib/club-command-center";
import type { ClubBroadcastRow } from "@/lib/club-communications";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}

export const metadata: Metadata = {
  title: "Manage club · CueBracket",
  description: "Private CueBracket organizer workspace.",
  robots: { index: false, follow: false },
};

export default async function ManageClubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { section } = await searchParams;
  const supabase = await createClient();
  const { data: clubData } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  const club = clubData as ClubRow | null;
  if (!club) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/clubs/${club.slug}/manage`)}`);

  const { data: ownMembershipData } = await supabase.from("club_members").select("club_id, user_id, role, created_at").eq("club_id", club.id).eq("user_id", user.id).maybeSingle();
  const ownMembership = ownMembershipData as ClubMemberRow | null;
  const role: ClubRole | null = club.owner_id === user.id ? "owner" : ownMembership?.role ?? null;
  if (role !== "owner" && role !== "admin") redirect(`/clubs/${club.slug}`);

  const now = new Date();
  const currentTime = now.toISOString();
  const calendarFloor = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [membersResult, pendingResult, followersResult, guideResult, announcementsResult, calendarResult, challengesResult, achievementsResult, galleryResult, reportsResult, restrictionsResult, blocksResult, broadcastsResult, liveEventsResult] = await Promise.all([
    supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at"),
    supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("status", "pending").order("created_at"),
    supabase.from("club_followers").select("user_id").eq("club_id", club.id),
    supabase.from("club_guides").select("club_id,opening_hours,rules,revision,updated_at").eq("club_id", club.id).maybeSingle(),
    supabase.from("club_announcements").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50),
    supabase.from("club_calendar_events").select("*").eq("club_id", club.id).gte("starts_at", calendarFloor).order("starts_at", { ascending: true }).limit(100),
    supabase.from("club_challenges").select("*").eq("club_id", club.id).neq("status", "closed").gte("expires_at", currentTime).order("updated_at", { ascending: false }).limit(100),
    supabase.from("club_achievements").select("*").eq("club_id", club.id).order("is_featured", { ascending: false }).order("awarded_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("club_gallery_items").select("*").eq("club_id", club.id).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("club_member_reports").select("*").eq("club_id", club.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("club_member_restrictions").select("*").eq("club_id", club.id),
    supabase.from("club_member_blocks").select("*").eq("club_id", club.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("club_broadcasts").select("*").eq("club_id", club.id).order("created_at", { ascending: false }).limit(25),
    supabase.from("cloud_tournaments").select("id").eq("club_id", club.id).eq("status", "live"),
  ]);

  const memberships = (membersResult.data ?? []) as ClubMemberRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const [profilesResult, followerCountsResult] = memberIds.length
    ? await Promise.all([
      supabase.from("profiles").select("id, display_name, username, tournament_name, avatar_url, is_public").in("id", memberIds),
      supabase.from("player_follower_counts").select("player_id,follower_count").in("player_id", memberIds),
    ])
    : [{ data: [] }, { data: [] }];
  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const followerCountMap = new Map((followerCountsResult.data ?? []).map((row) => [row.player_id, row.follower_count]));
  const members: ClubMemberView[] = memberships.map((membership) => {
    const profile = profileMap.get(membership.user_id);
    return {
      userId: membership.user_id,
      role: membership.role,
      name: profile?.tournament_name || profile?.display_name || "Club member",
      username: profile?.username ?? null,
      isPublic: profile?.is_public ?? false,
      avatarUrl: profile?.avatar_url ?? null,
      followerCount: followerCountMap.get(membership.user_id) ?? 0,
    };
  });
  const calendarEvents = (calendarResult.data ?? []) as ClubCalendarEventRow[];
  const calendarEventIds = calendarEvents.map((event) => event.id);
  const rsvpsResult = calendarEventIds.length
    ? await supabase.from("club_calendar_rsvps").select("*").eq("user_id", user.id).in("event_id", calendarEventIds)
    : { data: [] };

  return <main className="min-h-dvh bg-[#020617] text-white">
    <AppHeader />
    <ClubAdminWorkspace
      key={`${club.id}:${section ?? "overview"}`}
      initialSection={section}
      club={club}
      userId={user.id}
      role={role}
      guide={guideResult.data as ClubGuideRow | null}
      members={members}
      pendingRequests={(pendingResult.data ?? []) as ClubMembershipRequestRow[]}
      pendingRequestsError={Boolean(pendingResult.error)}
      announcements={(announcementsResult.data ?? []) as ClubAnnouncementRow[]}
      calendarEvents={calendarEvents}
      calendarRsvps={(rsvpsResult.data ?? []) as ClubCalendarRsvpRow[]}
      challenges={(challengesResult.data ?? []) as ClubChallengeRow[]}
      achievements={(achievementsResult.data ?? []) as ClubAchievementRow[]}
      galleryItems={(galleryResult.data ?? []) as ClubGalleryItemRow[]}
      reports={(reportsResult.data ?? []) as ClubMemberReportRow[]}
      restrictions={(restrictionsResult.data ?? []) as ClubMemberRestrictionRow[]}
      blocks={(blocksResult.data ?? []) as ClubMemberBlockRow[]}
      broadcasts={(broadcastsResult.data ?? []) as ClubBroadcastRow[]}
      followerCount={(followersResult.data ?? []).length}
      liveEventCount={(liveEventsResult.data ?? []).length}
    />
  </main>;
}
