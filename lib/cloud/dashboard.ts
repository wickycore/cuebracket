"use client";

import type { ClubMemberRow, ClubRow } from "@/lib/clubs";
import type { DashboardClub, DashboardData } from "@/lib/dashboard";
import type { NotificationRow } from "@/lib/notifications";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import { getMyCloudTournaments, rowToTournament } from "@/lib/cloud/tournaments";
import { getMyCloudLeagues, rowToLeague } from "@/lib/cloud/leagues";
import { getManagedVenueTables } from "@/lib/cloud/tables";
import { createClient } from "@/lib/supabase/client";

interface QueryResult<T> { data: T[] | null; error: { message: string } | null }

// Paginate lists used for counts, so PostgREST's default row limit cannot silently undercount.
export async function dashboardRows<T>(query: (start: number, end: number) => PromiseLike<QueryResult<T>>) {
  const rows: T[] = [];
  for (let start = 0; ; start += 200) {
    const result = await query(start, start + 199);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}

export async function loadDashboardData(expectedUserId: string): Promise<DashboardData> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.id !== expectedUserId) throw new Error("Your session changed. Please sign in again.");
  const issues: string[] = [];
  async function section<T>(label: string, task: () => PromiseLike<T>): Promise<T | null> {
    try { return await task(); } catch { issues.push(label); return null; }
  }
  const [cloudTournaments, cloudLeagues, tables, memberships, followed, owned, notifications, unreadCount] = await Promise.all([
    section("tournaments", getMyCloudTournaments),
    section("leagues", getMyCloudLeagues),
    section("tables", getManagedVenueTables),
    section("memberships", () => dashboardRows<ClubMemberRow>((from, to) => supabase.from("club_members").select("club_id,user_id,role,created_at").eq("user_id", user.id).order("club_id").range(from, to))),
    section("followed clubs", () => dashboardRows<{ club_id: string }>((from, to) => supabase.from("club_followers").select("club_id").eq("user_id", user.id).order("club_id").range(from, to))),
    section("owned clubs", () => dashboardRows<ClubRow>((from, to) => supabase.from("clubs").select("*").eq("owner_id", user.id).order("id").range(from, to))),
    section("notifications", async () => {
      const result = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
      if (result.error) throw result.error;
      return result.data as NotificationRow[];
    }),
    section("unread notifications", async () => {
      const result = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
      if (result.error) throw result.error;
      return result.count ?? 0;
    }),
  ]);
  const clubIds = [...new Set([...(memberships ?? []).map((item) => item.club_id), ...(followed ?? []).map((item) => item.club_id), ...(owned ?? []).map((item) => item.id)])];
  const clubRows = clubIds.length ? await section("club details", () => dashboardRows<ClubRow>((from, to) => supabase.from("clubs").select("*").in("id", clubIds).order("name").order("id").range(from, to))) : [];
  const clubs = clubRows ? await Promise.all(clubRows.map(async (club): Promise<DashboardClub> => {
    const role = club.owner_id === user.id ? "owner" : memberships?.find((member) => member.club_id === club.id)?.role ?? "following";
    const [memberCount, pendingRequests] = await Promise.all([
      section("member counts", async () => {
        const result = await supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", club.id);
        if (result.error) throw result.error;
        return result.count ?? 0;
      }),
      role === "owner" || role === "admin" ? section("membership requests", async () => {
        const result = await supabase.from("club_membership_requests").select("id", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "pending");
        if (result.error) throw result.error;
        return result.count ?? 0;
      }) : Promise.resolve(0),
    ]);
    return { ...club, role, memberCount, pendingRequests };
  })) : null;
  const tournamentIds = (cloudTournaments ?? []).filter((event) => event.status !== "completed").map((event) => event.id);
  const registrations = cloudTournaments === null ? null : tournamentIds.length ? await section("registrations", () => dashboardRows<{ tournament_id: string; status: string }>((from, to) =>
    supabase.from("event_registrations").select("tournament_id,status").in("tournament_id", tournamentIds).in("status", ["pending", "approved", "checked_in"]).order("id").range(from, to))) : [];
  const ownEntries = await section("your entries", () => dashboardRows<{ tournament_id: string }>((from, to) => supabase.from("event_registrations").select("tournament_id").eq("profile_id", user.id).in("status", ["pending", "approved", "checked_in", "waitlisted"]).order("id").range(from, to)));
  const relatedIds = [...new Set([...tournamentIds, ...(ownEntries ?? []).map((entry) => entry.tournament_id)])];
  const filters = [`owner_id.eq.${user.id}`];
  if (clubIds.length) filters.push(`club_id.in.(${clubIds.join(",")})`);
  if (relatedIds.length) filters.push(`tournament_id.in.(${relatedIds.join(",")})`);
  const events = await section("upcoming events", () => dashboardRows<RegistrationSettingsRow>((from, to) => supabase.from("event_registration_settings").select("*").or(filters.join(",")).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").order("tournament_id").range(from, to)));
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser?.id !== expectedUserId) throw new Error("Your session changed. Please sign in again.");
  return {
    tournaments: cloudTournaments?.map(rowToTournament) ?? null,
    leagues: cloudLeagues?.map(rowToLeague) ?? null, tables,
    clubs: memberships === null || owned === null || followed === null ? null : clubs,
    events, notifications, unreadCount,
    pendingRegistrations: registrations ? registrations.filter((row) => row.status === "pending").length : null,
    confirmedRegistrations: registrations ? registrations.filter((row) => row.status === "approved" || row.status === "checked_in").length : null,
    registrationEventIds: [...new Set((registrations ?? []).filter((row) => row.status === "pending").map((row) => row.tournament_id))],
    issues: [...new Set(issues)],
  };
}
