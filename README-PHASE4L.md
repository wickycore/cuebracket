# Phase 4L — Club Communication & Smart Reminders

Phase 4L gives organizers a focused way to reach club members without turning the club page into a group chat.

## Organizer communication center

- The Manage Club → Content section contains a dedicated communication center.
- Organizers can target members, followers, or both groups.
- Fixed templates cover general updates, tournaments, meetings, venue changes and registration openings.
- Broadcasts create private CueBracket inbox notifications and opt-in phone jobs.
- Sends are limited to five per organizer per club every ten minutes.
- Delivery history shows aggregate inbox recipients, opens, accepted phone deliveries and terminal phone failures.
- Organizer views never expose push endpoints, device details or private follower lists.

## Member controls

- Notifications includes a separate **Club messages & reminders** preference.
- Turning it off suppresses both organizer broadcasts and calendar reminders across every device.
- Phone notifications still require explicit browser or installed-app permission.
- Lock-screen previews remain generic; the complete club message stays in the authenticated inbox.

## Smart reminders

- A database job runs every 15 minutes.
- Members who marked a club calendar event **Going** or **Maybe** receive one reminder when it is within 24 hours.
- Cancelled and past events are skipped.
- Dedupe keys prevent repeated reminders.

## Security

- Only verified club owners/admins can call the broadcast RPC.
- Broadcast tables use RLS and explicit Data API grants.
- Browser clients receive read-only aggregate broadcast history and cannot insert notifications directly.
- Per-recipient delivery receipts live in the private schema and have no client grants.
- Supabase Auth, server route protection and existing RLS policies remain authoritative.
