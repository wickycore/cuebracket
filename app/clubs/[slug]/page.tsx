import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubCommandCenter } from "@/components/ClubCommandCenter";
import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubMembershipRequestRow, ClubMemberRow, ClubRow } from "@/lib/clubs";
import type {
  ClubAnnouncementRow,
  ClubAchievementRow,
  ClubCalendarEventRow,
  ClubCalendarRsvpRow,
  ClubChallengeRow,
  ClubLeagueSummary,
  ClubRegistrationCount,
  ClubTournamentSummary,
} from "@/lib/club-command-center";
import type { EventRegistrationRow, RegistrationSettingsRow } from "@/lib/cloud/registrations";
import type { ClubPlayerRankingRow } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";

interface Props { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }

async function getClub(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  return data as ClubRow | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  return club
    ? { title: `${club.name} Club Command Center · CueBracket`, description: club.description || `Follow ${club.name}, explore events, rankings, leagues and club updates.` }
    : { title: "Club not found" };
}

export default async function ClubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: clubData } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  const club = clubData as ClubRow | null;
  if (!club) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const [membersResult, followersResult] = await Promise.all([
    supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at"),
    supabase.from("club_followers").select("club_id, user_id").eq("club_id", club.id),
  ]);
  const memberships = (membersResult.data ?? []) as ClubMemberRow[];
  const followerIds = (followersResult.data ?? []).map((item) => item.user_id);
  const ownMembership = user ? memberships.find((item) => item.user_id === user.id) ?? null : null;
  const isAdmin = Boolean(user && (club.owner_id === user.id || ownMembership?.role === "owner" || ownMembership?.role === "admin"));
  const memberIds = memberships.map((item) => item.user_id);
  const currentDate = new Date();
  const currentTime = currentDate.toISOString();
  const calendarFloor = new Date(currentDate.getTime() - 30 * 86_400_000).toISOString();

  const [profilesResult, ownRequestResult, pendingResult, settingsResult, tournamentsResult, leaguesResult, rankingsResult, announcementsResult, tablesResult, calendarResult, challengesResult, achievementsResult] = await Promise.all([
    memberIds.length ? supabase.from("profiles").select("id, display_name, username, tournament_name, is_public").in("id", memberIds) : Promise.resolve({ data: [] }),
    user ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("user_id", user.id).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
    isAdmin ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("status", "pending").order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("event_registration_settings").select("*").eq("club_id", club.id).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(100),
    supabase.from("cloud_tournaments").select("id, name, venue, format, race_to, bracket_size, status, is_public, created_at, updated_at").eq("club_id", club.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("cloud_leagues").select("id, name, season, payload, is_public, updated_at").eq("club_id", club.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("club_player_rankings").select("*").eq("club_id", club.id).order("club_rank").limit(100),
    supabase.from("club_announcements").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50),
    isAdmin ? supabase.from("venue_tables").select("status").eq("club_id", club.id) : Promise.resolve({ data: [] }),
    supabase.from("club_calendar_events").select("*").eq("club_id", club.id).gte("starts_at", calendarFloor).order("starts_at", { ascending: true }).limit(100),
    supabase.from("club_challenges").select("*").eq("club_id", club.id).neq("status", "closed").gte("expires_at", currentTime).order("updated_at", { ascending: false }).limit(100),
    supabase.from("club_achievements").select("*").eq("club_id", club.id).order("is_featured", { ascending: false }).order("awarded_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
  ]);

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
  const ownProfile = user ? profileMap.get(user.id) : null;
  const settings = (settingsResult.data ?? []) as RegistrationSettingsRow[];
  const calendarEvents = (calendarResult.data ?? []) as ClubCalendarEventRow[];
  const calendarEventIds = calendarEvents.map((item) => item.id);
  const ownRsvpsResult = user && calendarEventIds.length
    ? await supabase.from("club_calendar_rsvps").select("*").eq("user_id", user.id).in("event_id", calendarEventIds)
    : { data: [] };
  const tournamentIds = settings.map((item) => item.tournament_id);
  const registrationsResult = tournamentIds.length
    ? await supabase.from("event_registrations").select("tournament_id, status").in("tournament_id", tournamentIds).in("status", ["approved", "checked_in", "waitlisted"]).limit(10000)
    : { data: [] };
  const counts = new Map<string, ClubRegistrationCount>();
  for (const row of (registrationsResult.data ?? []) as Pick<EventRegistrationRow, "tournament_id" | "status">[]) {
    const current = counts.get(row.tournament_id) ?? { tournamentId: row.tournament_id, confirmed: 0, waitlisted: 0 };
    if (row.status === "waitlisted") current.waitlisted += 1;
    else current.confirmed += 1;
    counts.set(row.tournament_id, current);
  }
  const tableCounts = { available: 0, playing: 0, reserved: 0 };
  for (const table of (tablesResult.data ?? []) as Array<{ status: keyof typeof tableCounts }>) {
    if (table.status === "available" || table.status === "playing" || table.status === "reserved") tableCounts[table.status] += 1;
  }

  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <ClubCommandCenter
        key={`${club.id}:${tab ?? "home"}`}
        initialTab={tab}
        club={club}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
        isFollowing={Boolean(user && followerIds.includes(user.id))}
        followerCount={followerIds.length}
        ownRole={ownMembership?.role ?? null}
        ownRequest={ownRequestResult.data as ClubMembershipRequestRow | null}
        pendingRequests={(pendingResult.data ?? []) as ClubMembershipRequestRow[]}
        members={members}
        defaultRequestName={ownProfile?.tournament_name || ownProfile?.display_name || ""}
        tournaments={(tournamentsResult.data ?? []) as ClubTournamentSummary[]}
        registrationSettings={settings}
        registrationCounts={[...counts.values()]}
        leagues={(leaguesResult.data ?? []) as ClubLeagueSummary[]}
        rankings={(rankingsResult.data ?? []) as ClubPlayerRankingRow[]}
        announcements={(announcementsResult.data ?? []) as ClubAnnouncementRow[]}
        calendarEvents={calendarEvents}
        calendarRsvps={(ownRsvpsResult.data ?? []) as ClubCalendarRsvpRow[]}
        challenges={(challengesResult.data ?? []) as ClubChallengeRow[]}
        achievements={(achievementsResult.data ?? []) as ClubAchievementRow[]}
        tableCounts={tableCounts}
      />
    </main>
  );
}
