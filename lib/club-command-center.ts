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

export type ClubCalendarKind = "tournament" | "practice" | "meeting" | "social" | "other";
export type ClubCalendarResponse = "going" | "maybe";

export interface ClubCalendarEventRow {
  id: string;
  club_id: string;
  creator_id: string;
  title: string;
  kind: ClubCalendarKind;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  capacity: number | null;
  is_cancelled: boolean;
  going_count: number;
  maybe_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClubCalendarRsvpRow {
  event_id: string;
  user_id: string;
  response: ClubCalendarResponse;
  created_at: string;
  updated_at: string;
}

export type ClubChallengeGame = "8-ball" | "9-ball" | "10-ball" | "snooker" | "blackball" | "any";
export type ClubChallengeSkill = "beginner" | "intermediate" | "advanced" | "any";
export type ClubChallengeStatus = "open" | "matched" | "closed";

export interface ClubChallengeRow {
  id: string;
  club_id: string;
  creator_id: string;
  accepted_by: string | null;
  title: string;
  message: string;
  game_type: ClubChallengeGame;
  skill_level: ClubChallengeSkill;
  race_to: number | null;
  preferred_at: string | null;
  venue: string;
  expires_at: string;
  status: ClubChallengeStatus;
  created_at: string;
  updated_at: string;
}

export type ClubAchievementKind =
  | "champion"
  | "podium"
  | "milestone"
  | "sportsmanship"
  | "contribution"
  | "custom";

export interface ClubAchievementRow {
  id: string;
  club_id: string;
  recipient_id: string;
  awarded_by: string | null;
  kind: ClubAchievementKind;
  title: string;
  description: string;
  awarded_on: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClubActivityItem {
  id: string;
  label: string;
  title: string;
  detail: string;
  occurredAt: string;
  tab: "events" | "rankings" | "clubhouse";
  tone: "cyan" | "emerald" | "violet" | "amber";
}

export function validateClubCalendarEvent(input: {
  title: string;
  kind: ClubCalendarKind;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  capacity?: number | null;
}, now = new Date()) {
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  const value = {
    title: input.title.trim().replace(/\s+/g, " "),
    kind: input.kind,
    description: input.description.trim(),
    startsAt,
    endsAt,
    location: input.location.trim().replace(/\s+/g, " "),
    capacity: input.capacity ?? null,
  };
  const kinds: ClubCalendarKind[] = ["tournament", "practice", "meeting", "social", "other"];
  if (value.title.length < 3 || value.title.length > 100) return { ok: false as const, message: "Event title must contain 3–100 characters." };
  if (!kinds.includes(value.kind)) return { ok: false as const, message: "Choose a valid event type." };
  if (value.description.length > 1000) return { ok: false as const, message: "Event details must be 1000 characters or fewer." };
  if (value.location.length > 100) return { ok: false as const, message: "Event location must be 100 characters or fewer." };
  if (!Number.isFinite(value.startsAt.getTime()) || value.startsAt <= now) return { ok: false as const, message: "Choose a future event time." };
  if (value.endsAt && (!Number.isFinite(value.endsAt.getTime()) || value.endsAt <= value.startsAt)) return { ok: false as const, message: "The end time must be after the start time." };
  if (value.capacity !== null && (!Number.isInteger(value.capacity) || value.capacity < 2 || value.capacity > 500)) return { ok: false as const, message: "Capacity must be between 2 and 500." };
  return { ok: true as const, value };
}

export function validateClubChallenge(input: {
  title: string;
  message: string;
  gameType: ClubChallengeGame;
  skillLevel: ClubChallengeSkill;
  raceTo?: number | null;
  preferredAt?: string | null;
  venue: string;
  expiresAt: string;
}, now = new Date()) {
  const preferredAt = input.preferredAt ? new Date(input.preferredAt) : null;
  const expiresAt = new Date(input.expiresAt);
  const value = {
    title: input.title.trim().replace(/\s+/g, " "),
    message: input.message.trim(),
    gameType: input.gameType,
    skillLevel: input.skillLevel,
    raceTo: input.raceTo ?? null,
    preferredAt,
    venue: input.venue.trim().replace(/\s+/g, " "),
    expiresAt,
  };
  const games: ClubChallengeGame[] = ["8-ball", "9-ball", "10-ball", "snooker", "blackball", "any"];
  const skills: ClubChallengeSkill[] = ["beginner", "intermediate", "advanced", "any"];
  if (value.title.length < 3 || value.title.length > 80) return { ok: false as const, message: "Challenge title must contain 3–80 characters." };
  if (value.message.length > 500) return { ok: false as const, message: "Challenge details must be 500 characters or fewer." };
  if (!games.includes(value.gameType) || !skills.includes(value.skillLevel)) return { ok: false as const, message: "Choose valid game and skill options." };
  if (value.raceTo !== null && (!Number.isInteger(value.raceTo) || value.raceTo < 1 || value.raceTo > 50)) return { ok: false as const, message: "Race length must be between 1 and 50." };
  if (value.preferredAt && (!Number.isFinite(value.preferredAt.getTime()) || value.preferredAt <= now)) return { ok: false as const, message: "Choose a future practice time." };
  if (value.venue.length > 100) return { ok: false as const, message: "Venue must be 100 characters or fewer." };
  if (!Number.isFinite(value.expiresAt.getTime()) || value.expiresAt <= now || value.expiresAt > new Date(now.getTime() + 30 * 86_400_000)) return { ok: false as const, message: "Challenge expiry must be within the next 30 days." };
  return { ok: true as const, value };
}

export function validateClubAchievement(input: {
  recipientId: string;
  kind: ClubAchievementKind;
  title: string;
  description: string;
  awardedOn: string;
  isFeatured: boolean;
}, now = new Date()) {
  const value = {
    recipientId: input.recipientId.trim(),
    kind: input.kind,
    title: input.title.trim().replace(/\s+/g, " "),
    description: input.description.trim(),
    awardedOn: input.awardedOn.trim(),
    isFeatured: input.isFeatured,
  };
  const kinds: ClubAchievementKind[] = ["champion", "podium", "milestone", "sportsmanship", "contribution", "custom"];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value.awardedOn) ? new Date(`${value.awardedOn}T00:00:00Z`) : new Date(Number.NaN);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.recipientId)) return { ok: false as const, message: "Choose a club member to recognise." };
  if (!kinds.includes(value.kind)) return { ok: false as const, message: "Choose a valid achievement type." };
  if (value.title.length < 3 || value.title.length > 80) return { ok: false as const, message: "Achievement title must contain 3–80 characters." };
  if (!value.description || value.description.length > 300) return { ok: false as const, message: "Recognition details must contain 1–300 characters." };
  if (!Number.isFinite(date.getTime()) || date > today) return { ok: false as const, message: "Choose today or an earlier achievement date." };
  return { ok: true as const, value };
}

export function clubAchievementLabel(kind: ClubAchievementKind) {
  return {
    champion: "Champion",
    podium: "Podium finish",
    milestone: "Milestone",
    sportsmanship: "Sportsmanship",
    contribution: "Club contribution",
    custom: "Club honour",
  }[kind];
}

export function clubAchievementIcon(kind: ClubAchievementKind) {
  return {
    champion: "🏆",
    podium: "🥇",
    milestone: "🎯",
    sportsmanship: "🤝",
    contribution: "⭐",
    custom: "🎖️",
  }[kind];
}

export function clubCalendarKindLabel(kind: ClubCalendarKind) {
  return { tournament: "Tournament", practice: "Practice", meeting: "Meeting", social: "Social", other: "Club event" }[kind];
}

export function buildClubActivityFeed(input: {
  announcements: ClubAnnouncementRow[];
  tournaments: ClubTournamentSummary[];
  leagues: ClubLeagueSummary[];
  calendarEvents: ClubCalendarEventRow[];
  challenges: ClubChallengeRow[];
  achievements?: ClubAchievementRow[];
}, limit = 12): ClubActivityItem[] {
  return [
    ...input.announcements.map((item): ClubActivityItem => ({ id: `announcement:${item.id}`, label: clubAnnouncementLabel(item.kind), title: item.title, detail: item.body, occurredAt: item.published_at, tab: "clubhouse", tone: "cyan" })),
    ...input.tournaments.map((item): ClubActivityItem => ({ id: `tournament:${item.id}`, label: item.status === "live" ? "Live tournament" : item.status === "completed" ? "Tournament result" : "Tournament", title: item.name, detail: `${item.venue || "Venue TBA"} · ${item.format.replaceAll("_", " ")}`, occurredAt: item.updated_at, tab: item.status === "completed" ? "rankings" : "events", tone: item.status === "live" ? "emerald" : "cyan" })),
    ...input.leagues.map((item): ClubActivityItem => ({ id: `league:${item.id}`, label: item.payload?.status === "live" ? "Live league" : "League season", title: item.name, detail: `${item.season} · ${item.payload?.players?.length ?? 0} players`, occurredAt: item.updated_at, tab: "clubhouse", tone: "violet" })),
    ...input.calendarEvents.map((item): ClubActivityItem => ({ id: `calendar:${item.id}`, label: item.is_cancelled ? "Cancelled event" : clubCalendarKindLabel(item.kind), title: item.title, detail: `${clubDateLabel(item.starts_at)}${item.location ? ` · ${item.location}` : ""}`, occurredAt: item.updated_at, tab: "events", tone: item.is_cancelled ? "amber" : "emerald" })),
    ...input.challenges.map((item): ClubActivityItem => ({ id: `challenge:${item.id}`, label: item.status === "matched" ? "Practice matched" : "Practice challenge", title: item.title, detail: `${item.game_type === "any" ? "Any cue game" : item.game_type}${item.race_to ? ` · Race to ${item.race_to}` : ""}`, occurredAt: item.updated_at, tab: "clubhouse", tone: item.status === "matched" ? "emerald" : "amber" })),
    ...(input.achievements ?? []).map((item): ClubActivityItem => ({ id: `achievement:${item.id}`, label: clubAchievementLabel(item.kind), title: item.title, detail: item.description, occurredAt: item.updated_at, tab: "rankings", tone: "amber" })),
  ].filter((item) => Number.isFinite(new Date(item.occurredAt).getTime())).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
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
