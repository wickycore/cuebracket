import type { League } from "@/lib/leagues";

export type ClubAnnouncementKind =
  | "general"
  | "event"
  | "venue"
  | "league"
  | "result";

export interface ClubAnnouncementRow {
  id: string;
  club_id: string;
  author_id: string;
  kind: ClubAnnouncementKind;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface ClubTournamentSummary {
  id: string;
  name: string;
  venue: string;
  format: string;
  race_to: number;
  bracket_size: number;
  status: "draft" | "live" | "completed";
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClubLeagueSummary {
  id: string;
  name: string;
  season: string;
  payload: League;
  is_public: boolean;
  updated_at: string;
}

export interface ClubRegistrationCount {
  tournamentId: string;
  confirmed: number;
  waitlisted: number;
}

export function validateClubAnnouncement(input: {
  kind: ClubAnnouncementKind;
  title: string;
  body: string;
}) {
  const value = {
    kind: input.kind,
    title: input.title.trim().replace(/\s+/g, " "),
    body: input.body.trim(),
  };
  const kinds: ClubAnnouncementKind[] = [
    "general",
    "event",
    "venue",
    "league",
    "result",
  ];
  if (!kinds.includes(value.kind)) {
    return { ok: false as const, message: "Choose a valid announcement type." };
  }
  if (value.title.length < 3 || value.title.length > 100) {
    return { ok: false as const, message: "Announcement title must contain 3–100 characters." };
  }
  if (!value.body || value.body.length > 1000) {
    return { ok: false as const, message: "Announcement message must contain 1–1000 characters." };
  }
  return { ok: true as const, value };
}

export function clubAnnouncementLabel(kind: ClubAnnouncementKind) {
  return {
    general: "Club update",
    event: "Event",
    venue: "Venue",
    league: "League",
    result: "Result",
  }[kind];
}

export function clubDateLabel(value: string | null | undefined) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(date);
}
