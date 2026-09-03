import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubCommandCenter } from "@/components/ClubCommandCenter";
import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubGuideRow, ClubMembershipRequestRow, ClubMemberRow, ClubRole, ClubRow } from "@/lib/clubs";
import type {
  ClubAnnouncementRow,
  ClubAchievementRow,
  ClubCalendarEventRow,
  ClubCalendarRsvpRow,
  ClubChallengeRow,
  ClubGalleryItemRow,
  ClubMemberRestrictionRow,
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
  const { data, error } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  if (error) throw new Error("The club could not be loaded.");
  return data as ClubRow | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  return club
    ? {
        title: `${club.name} Club Command Center · CueBracket`,
        description: club.description || `Follow ${club.name}, explore events, rankings, leagues and club updates.`,
        alternates: { canonical: `/clubs/${club.slug}` },
      }
    : { title: "Club not found" };
}

export default async function ClubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: clubData, error: clubError } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  if (clubError) throw new Error("The club could not be loaded.");
  const club = clubData as ClubRow | null;
  if (!club) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const [ownMembershipResult, ownFollowResult, memberCountResult, ownRestrictionResult] = await Promise.all([
    user ? supabase.from("club_members").select("club_id,user_id,role,created_at").eq("club_id", club.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    user ? supabase.from("club_followers").select("club_id,user_id").eq("club_id", club.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("club_member_counts").select("member_count").eq("club_id", club.id).maybeSingle(),
    user ? supabase.from("club_member_restrictions").select("*").eq("club_id", club.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (ownMembershipResult.error || ownFollowResult.error || memberCountResult.error || ownRestrictionResult.error) throw new Error("The club membership could not be loaded.");
  const ownMembership = ownMembershipResult.data as ClubMemberRow | null;
  const ownRole: ClubRole | null = club.owner_id === user?.id ? "owner" : ownMembership?.role ?? null;
  const isAdmin = ownRole === "owner" || ownRole === "admin";
  const ownRestriction = ownRestrictionResult.data as ClubMemberRestrictionRow | null;
  const isSuspended = Boolean(ownRestriction?.is_suspended && !isAdmin);
  const isMuted = Boolean(ownRestriction?.is_muted && !isAdmin);
  const isMember = isAdmin || Boolean(ownRole && !isSuspended);

  const [membersResult, followerTotalResult] = await Promise.all([
    isMember ? supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at") : Promise.resolve({ data: [], error: null }),
    isMember ? supabase.from("club_follower_counts").select("follower_count").eq("club_id", club.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (membersResult.error || followerTotalResult.error) throw new Error("The private club membership could not be loaded.");
  const memberships = (membersResult.data ?? []) as ClubMemberRow[];
  const memberIds = memberships.map((item) => item.user_id);
  const currentDate = new Date();
  const currentTime = currentDate.toISOString();
  const calendarFloor = new Date(currentDate.getTime() - 30 * 86_400_000).toISOString();

  const [profilesResult, followerCountsResult, guideResult, ownRequestResult, settingsResult, tournamentsResult, leaguesResult, rankingsResult, announcementsResult, calendarResult, challengesResult, achievementsResult, galleryResult, ownProfileResult, ownRegistrationsResult, playerFollowsResult] = await Promise.all([
    memberIds.length ? supabase.from("profiles").select("id, display_name, username, tournament_name, avatar_url, is_public").in("id", memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("player_follower_counts").select("player_id,follower_count").in("player_id", memberIds) : Promise.resolve({ data: [] }),
    supabase.from("club_guides").select("club_id,opening_hours,rules,revision,updated_at").eq("club_id", club.id).maybeSingle(),
    user ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("user_id", user.id).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("event_registration_settings").select("*").eq("club_id", club.id).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(100),
    supabase.from("cloud_tournaments").select("id, name, venue, poster_url, format, race_to, bracket_size, status, is_public, created_at, updated_at").eq("club_id", club.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("cloud_leagues").select("id, name, season, payload, is_public, updated_at").eq("club_id", club.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("club_player_rankings").select("*").eq("club_id", club.id).order("club_rank").limit(100),
    isMember ? supabase.from("club_announcements").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    isMember ? supabase.from("club_calendar_events").select("*").eq("club_id", club.id).gte("starts_at", calendarFloor).order("starts_at", { ascending: true }).limit(100) : Promise.resolve({ data: [], error: null }),
    isMember ? supabase.from("club_challenges").select("*").eq("club_id", club.id).neq("status", "closed").gte("expires_at", currentTime).order("updated_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    supabase.from("club_achievements").select("*").eq("club_id", club.id).order("is_featured", { ascending: false }).order("awarded_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("club_gallery_items").select("*").eq("club_id", club.id).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    user ? supabase.from("profiles").select("display_name,tournament_name,avatar_url,username").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    user ? supabase.from("event_registrations").select("tournament_id").eq("profile_id", user.id).in("status", ["approved", "checked_in", "waitlisted"]).limit(500) : Promise.resolve({ data: [], error: null }),
    user ? supabase.from("player_followers").select("player_id").eq("user_id", user.id).limit(1000) : Promise.resolve({ data: [], error: null }),
  ]);

  const sectionError = [profilesResult, followerCountsResult, guideResult, ownRequestResult, settingsResult, tournamentsResult, leaguesResult, rankingsResult, announcementsResult, calendarResult, challengesResult, achievementsResult, galleryResult, ownProfileResult, ownRegistrationsResult, playerFollowsResult]
    .find((result) => "error" in result && result.error);
  if (sectionError) throw new Error("Some club information could not be loaded.");

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
  const ownProfile = ownProfileResult.data;
  const settings = (settingsResult.data ?? []) as RegistrationSettingsRow[];
  const calendarEvents = (calendarResult.data ?? []) as ClubCalendarEventRow[];
  const calendarEventIds = calendarEvents.map((item) => item.id);
  const ownRsvpsResult = user && calendarEventIds.length
    ? await supabase.from("club_calendar_rsvps").select("*").eq("user_id", user.id).in("event_id", calendarEventIds)
    : { data: [] };
  if ("error" in ownRsvpsResult && ownRsvpsResult.error) throw new Error("Club responses could not be loaded.");
  const tournamentIds = settings.map((item) => item.tournament_id);
  const registrationsResult = tournamentIds.length
    ? await supabase.from("event_registrations").select("tournament_id, status").in("tournament_id", tournamentIds).in("status", ["approved", "checked_in", "waitlisted"]).limit(10000)
    : { data: [] };
  if ("error" in registrationsResult && registrationsResult.error) throw new Error("Club registration totals could not be loaded.");
  const counts = new Map<string, ClubRegistrationCount>();
  for (const row of (registrationsResult.data ?? []) as Pick<EventRegistrationRow, "tournament_id" | "status">[]) {
    const current = counts.get(row.tournament_id) ?? { tournamentId: row.tournament_id, confirmed: 0, waitlisted: 0 };
    if (row.status === "waitlisted") current.waitlisted += 1;
    else current.confirmed += 1;
    counts.set(row.tournament_id, current);
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
        isMember={isMember}
        isSuspended={isSuspended}
        isMuted={isMuted}
        isFollowing={Boolean(ownFollowResult.data)}
        memberCount={memberCountResult.data?.member_count ?? 0}
        followerCount={isMember ? followerTotalResult.data?.follower_count ?? 0 : null}
        ownRole={ownRole}
        ownRequest={ownRequestResult.data as ClubMembershipRequestRow | null}
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
        galleryItems={(galleryResult.data ?? []) as ClubGalleryItemRow[]}
        ownProfile={ownProfile ? { avatar_url: ownProfile.avatar_url ?? null, username: ownProfile.username ?? null } : null}
        ownRegistrationIds={(ownRegistrationsResult.data ?? []).map((row) => row.tournament_id)}
        followedPlayerIds={(playerFollowsResult.data ?? []).map((row) => row.player_id)}
        guide={guideResult.data as ClubGuideRow | null}
      />
    </main>
  );
}
