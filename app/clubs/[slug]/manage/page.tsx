import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubAdminWorkspace } from "@/components/ClubAdminWorkspace";
import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubMemberRow, ClubMembershipRequestRow, ClubRole, ClubRow } from "@/lib/clubs";
import type {
  ClubAchievementRow,
  ClubAnnouncementRow,
  ClubCalendarEventRow,
  ClubCalendarRsvpRow,
  ClubChallengeRow,
} from "@/lib/club-command-center";
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
  const [membersResult, pendingResult, followersResult, announcementsResult, calendarResult, challengesResult, achievementsResult, liveEventsResult] = await Promise.all([
    supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at"),
    supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("status", "pending").order("created_at"),
    supabase.from("club_followers").select("user_id").eq("club_id", club.id),
    supabase.from("club_announcements").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50),
    supabase.from("club_calendar_events").select("*").eq("club_id", club.id).gte("starts_at", calendarFloor).order("starts_at", { ascending: true }).limit(100),
    supabase.from("club_challenges").select("*").eq("club_id", club.id).neq("status", "closed").gte("expires_at", currentTime).order("updated_at", { ascending: false }).limit(100),
    supabase.from("club_achievements").select("*").eq("club_id", club.id).order("is_featured", { ascending: false }).order("awarded_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("cloud_tournaments").select("id").eq("club_id", club.id).eq("status", "live"),
  ]);

  const memberships = (membersResult.data ?? []) as ClubMemberRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const profilesResult = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, username, tournament_name, is_public").in("id", memberIds)
    : { data: [] };
  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const members: ClubMemberView[] = memberships.map((membership) => {
    const profile = profileMap.get(membership.user_id);
    return {
      userId: membership.user_id,
      role: membership.role,
      name: profile?.tournament_name || profile?.display_name || "Club member",
      username: profile?.username ?? null,
      isPublic: profile?.is_public ?? false,
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
      members={members}
      pendingRequests={(pendingResult.data ?? []) as ClubMembershipRequestRow[]}
      announcements={(announcementsResult.data ?? []) as ClubAnnouncementRow[]}
      calendarEvents={calendarEvents}
      calendarRsvps={(rsvpsResult.data ?? []) as ClubCalendarRsvpRow[]}
      challenges={(challengesResult.data ?? []) as ClubChallengeRow[]}
      achievements={(achievementsResult.data ?? []) as ClubAchievementRow[]}
      followerCount={(followersResult.data ?? []).length}
      liveEventCount={(liveEventsResult.data ?? []).length}
    />
  </main>;
}
