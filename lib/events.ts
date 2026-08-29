export type DiscoveryEventType = "tournament" | "league";
export type DiscoveryDateFilter = "all" | "week" | "month" | "later" | "tba";

export interface DiscoveryEvent {
  id: string;
  type: DiscoveryEventType;
  name: string;
  clubId: string | null;
  clubName: string;
  clubSlug: string | null;
  venue: string;
  format: string;
  raceTo: number;
  startsAt: string | null;
  endsAt: string | null;
  entryFee: string;
  capacity: number | null;
  confirmed: number;
  waitlisted: number;
  registrationOpen: boolean;
  status: string;
  followed: boolean;
  href: string;
}

const DAY = 86_400_000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function eventDateGroup(startsAt: string | null, now = new Date()): DiscoveryDateFilter {
  if (!startsAt) return "tba";
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) return "tba";
  const today = startOfDay(now);
  const eventDay = startOfDay(start);
  const days = Math.floor((eventDay.getTime() - today.getTime()) / DAY);
  if (days <= 7) return "week";
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (eventDay < monthEnd) return "month";
  return "later";
}

export function eventHasSpace(event: DiscoveryEvent) {
  return event.capacity === null || event.confirmed < event.capacity;
}

export function eventSearchText(event: DiscoveryEvent) {
  return [event.name, event.clubName, event.venue, event.format, event.entryFee]
    .join(" ")
    .toLowerCase();
}

export function sortDiscoveryEvents(events: DiscoveryEvent[]) {
  return [...events].sort((first, second) => {
    if (!first.startsAt && !second.startsAt) return first.name.localeCompare(second.name);
    if (!first.startsAt) return 1;
    if (!second.startsAt) return -1;
    return new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime();
  });
}
