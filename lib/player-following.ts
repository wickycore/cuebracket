export interface FollowedProfile {
  id: string;
  username: string | null;
  display_name: string;
  tournament_name: string | null;
  is_public: boolean;
}

export interface PlayerFollow {
  player_id: string;
  notify_live: boolean;
  player: FollowedProfile | null;
}

export interface PlayerLiveMatch {
  profile_id: string;
  event_type: "tournament" | "league";
  event_id: string;
  match_key: string;
  event_name: string;
  player1: string;
  player2: string;
  score1: number | null;
  score2: number | null;
  table_name: string | null;
  updated_at: string;
}

export function liveMatchKey(match: PlayerLiveMatch) {
  return JSON.stringify([match.event_type, match.event_id, match.match_key]);
}

export function uniqueLiveMatches(matches: PlayerLiveMatch[]) {
  const unique = new Map<string, PlayerLiveMatch>();
  for (const match of matches) {
    const key = liveMatchKey(match);
    if (!unique.has(key) || unique.get(key)!.updated_at < match.updated_at) unique.set(key, match);
  }
  return [...unique.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function liveMatchHref(match: PlayerLiveMatch) {
  return `${match.event_type === "tournament" ? "/cloud/live" : "/league"}/${encodeURIComponent(match.event_id)}`;
}

export function validateClubGuide(hours: string, rules: string) {
  if (hours.trim().length > 500) return "Opening hours must be 500 characters or fewer.";
  if (rules.trim().length > 3000) return "Club rules must be 3,000 characters or fewer.";
  return null;
}
