export interface PlayerStatisticsRow {
  profile_id: string;
  display_name: string;
  username: string | null;
  tournament_name: string | null;
  avatar_url: string | null;
  matches_played: number;
  wins: number;
  losses: number;
  frames_for: number;
  frames_against: number;
  frame_difference: number;
  win_percentage: number;
  titles: number;
  podiums: number;
  tournaments_played: number;
  ranking_points: number;
  last_played_at: string | null;
}

export interface PlayerRankingRow extends PlayerStatisticsRow {
  global_rank: number;
}

export interface ClubPlayerRankingRow extends PlayerStatisticsRow {
  club_id: string;
  club_rank: number;
}

export interface PlayerTournamentHistoryRow {
  profile_id: string;
  tournament_id: string;
  tournament_name: string;
  venue: string;
  format: string;
  club_id: string | null;
  club_name: string | null;
  status: string;
  placement: number | null;
  matches_played: number;
  wins: number;
  losses: number;
  frames_for: number;
  frames_against: number;
  played_at: string;
}

export const RANKING_POINTS_DESCRIPTION =
  "10 points per verified match win, plus 100 for a title, 60 for runner-up and 40 for third place.";

export function placementLabel(placement: number | null) {
  if (placement === 1) return "Champion";
  if (placement === 2) return "Runner-up";
  if (placement === 3) return "Third place";
  return "Played";
}
