import type { ClubRole, ClubRow } from "@/lib/clubs";
import type { League } from "@/lib/leagues";
import type { NotificationRow } from "@/lib/notifications";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import type { VenueTableRow } from "@/lib/cloud/tables";
import { getAllMatches, getFormatLabel, getTournamentEventCounts, type Tournament } from "@/lib/tournaments";

export interface DashboardClub extends ClubRow {
  role: ClubRole | "following";
  memberCount: number | null;
  pendingRequests: number | null;
}

export interface DashboardData {
  tournaments: Tournament[] | null;
  leagues: League[] | null;
  clubs: DashboardClub[] | null;
  events: RegistrationSettingsRow[] | null;
  notifications: NotificationRow[] | null;
  unreadCount: number | null;
  tables: VenueTableRow[] | null;
  pendingRegistrations: number | null;
  confirmedRegistrations: number | null;
  registrationEventIds: string[];
  issues: string[];
}

export interface DashboardEvent {
  id: string;
  kind: "tournament" | "league";
  name: string;
  href: string;
  status: "draft" | "live" | "completed";
  detail: string;
  venue: string;
  updatedAt: string;
  completed: number;
  total: number;
  liveMatches: number;
  pendingMatches: number;
}

export function dashboardGreeting(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Nairobi" }).format(date));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function dashboardDate(value: string, withTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-KE", {
    weekday: withTime ? undefined : "short", day: "numeric", month: "short",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
    timeZone: "Africa/Nairobi",
  }).format(date);
}

export function mergeDashboardRecords<T extends { id: string; updatedAt: string }>(
  cloud: T[], local: T[], userId: string, ownerOf: (id: string) => string | null,
) {
  const records = new Map(cloud.map((record) => [record.id, record]));
  for (const record of local) {
    const owner = ownerOf(record.id);
    // Unknown device records may belong to a previous account on a shared phone.
    if (owner !== userId && !records.has(record.id)) continue;
    const remote = records.get(record.id);
    if (!remote || Date.parse(record.updatedAt) > Date.parse(remote.updatedAt)) records.set(record.id, record);
  }
  return [...records.values()];
}

export function dashboardEvents(tournaments: Tournament[], leagues: League[]): DashboardEvent[] {
  const items: DashboardEvent[] = tournaments.map((tournament) => {
    const counts = getTournamentEventCounts(tournament);
    const matches = getAllMatches(tournament).filter((match) => match.player1 && match.player2);
    return {
      id: tournament.id, kind: "tournament", name: tournament.name, href: `/tournaments/${tournament.id}`,
      status: tournament.status, detail: `${getFormatLabel(tournament.format)} · Race to ${tournament.raceTo}`,
      venue: tournament.venue, updatedAt: tournament.updatedAt, completed: counts.completed, total: counts.total,
      liveMatches: matches.filter((match) => !match.completed && match.status === "live").length,
      pendingMatches: tournament.status === "live" ? counts.total - counts.completed : 0,
    };
  });
  for (const league of leagues) {
    const playoffs = league.playoff?.rounds.flatMap((round) => round.matches) ?? [];
    const fixtures = [...league.fixtures, ...playoffs.filter((match) => match.player1Id && match.player2Id)];
    items.push({
      id: league.id, kind: "league", name: league.name, href: `/leagues/${league.id}`, status: league.status,
      detail: `${league.season} · ${league.players.length} players${league.playoff?.enabled ? " · Playoffs" : ""}`,
      venue: league.venue, updatedAt: league.updatedAt, completed: fixtures.filter((match) => match.completed).length,
      total: fixtures.length, liveMatches: 0,
      pendingMatches: league.status === "live" ? fixtures.filter((match) => !match.completed).length : 0,
    });
  }
  const priority = { live: 0, draft: 1, completed: 2 };
  return items.sort((a, b) => priority[a.status] - priority[b.status] || b.liveMatches - a.liveMatches || b.updatedAt.localeCompare(a.updatedAt));
}

export function upcomingDashboardEvents(events: RegistrationSettingsRow[], now: string) {
  return events.filter((event) => event.scheduled_at && Date.parse(event.scheduled_at) >= Date.parse(now))
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
}

export function dashboardLiveMatchCount(tournaments: Tournament[], tables: VenueTableRow[]) {
  const playing = new Set<string>();
  for (const tournament of tournaments) {
    if (tournament.status !== "live") continue;
    for (const match of getAllMatches(tournament)) {
      if (!match.completed && match.player1 && match.player2 && match.status === "live") playing.add(`tournament:${tournament.id}:${match.id}`);
    }
  }
  for (const table of tables) {
    if (table.status === "playing" && table.active_event_type && table.active_event_id && table.active_match_id) {
      playing.add(`${table.active_event_type}:${table.active_event_id}:${table.active_match_id}`);
    }
  }
  return playing.size;
}

export function dashboardSafeHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : "/notifications";
}
