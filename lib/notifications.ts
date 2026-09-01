export type NotificationType = "club_event" | "registration_status" | "membership_status" | "match_live" | "table_assignment" | "followed_player_live" | "delivery_test" | "club_message" | "club_reminder";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferencesRow {
  user_id: string;
  club_events: boolean;
  registration_updates: boolean;
  match_alerts: boolean;
  followed_player_alerts: boolean;
  club_messages: boolean;
  updated_at: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  club_events: true,
  registration_updates: true,
  match_alerts: true,
  followed_player_alerts: true,
  club_messages: true,
};

export function notificationIcon(type: NotificationType) {
  if (type === "club_event") return "🏆";
  if (type === "registration_status") return "🎟️";
  if (type === "membership_status") return "👥";
  if (type === "club_message") return "📣";
  if (type === "club_reminder") return "📅";
  return "🎱";
}
