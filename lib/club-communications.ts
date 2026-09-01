export type ClubBroadcastAudience = "everyone" | "members" | "followers";
export type ClubBroadcastTemplate = "general" | "tournament" | "meeting" | "venue" | "registration";

export interface ClubBroadcastRow {
  id: string;
  club_id: string;
  author_id: string | null;
  audience: ClubBroadcastAudience;
  template: ClubBroadcastTemplate;
  title: string;
  message: string;
  recipient_count: number;
  opened_count: number;
  phone_sent_count: number;
  phone_failed_count: number;
  created_at: string;
}

export const CLUB_BROADCAST_TEMPLATES: Array<{
  id: ClubBroadcastTemplate;
  label: string;
  title: string;
  message: string;
}> = [
  { id: "general", label: "General update", title: "Club update", message: "Here’s the latest from the club:" },
  { id: "tournament", label: "Tournament", title: "Tournament update", message: "A tournament update for club members:" },
  { id: "meeting", label: "Club meeting", title: "Club meeting", message: "Club members are invited to our next meeting:" },
  { id: "venue", label: "Venue change", title: "Venue update", message: "Please note this venue update:" },
  { id: "registration", label: "Registration", title: "Registration is open", message: "Registration is now open. Visit the club page for details." },
];

export function validateClubBroadcast(input: {
  audience: ClubBroadcastAudience;
  template: ClubBroadcastTemplate;
  title: string;
  message: string;
}) {
  const value = {
    audience: input.audience,
    template: input.template,
    title: input.title.trim().replace(/\s+/g, " "),
    message: input.message.trim(),
  };
  if (!["everyone", "members", "followers"].includes(value.audience)) return { ok: false as const, message: "Choose a valid audience." };
  if (!CLUB_BROADCAST_TEMPLATES.some((item) => item.id === value.template)) return { ok: false as const, message: "Choose a valid template." };
  if (value.title.length < 3 || value.title.length > 100) return { ok: false as const, message: "Title must contain 3–100 characters." };
  if (value.message.length < 3 || value.message.length > 500) return { ok: false as const, message: "Message must contain 3–500 characters." };
  return { ok: true as const, value };
}

export function clubBroadcastAudienceLabel(audience: ClubBroadcastAudience) {
  if (audience === "members") return "Members only";
  if (audience === "followers") return "Followers only";
  return "Members & followers";
}
