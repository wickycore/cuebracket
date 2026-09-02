import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { DataLoadNotice } from "@/components/DataLoadNotice";
import { EventDiscovery } from "@/components/EventDiscovery";
import type { ClubRow } from "@/lib/clubs";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import { sortDiscoveryEvents, type DiscoveryEvent } from "@/lib/events";
import type { League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Discover pool events",
  description: "Find upcoming pool tournaments and leagues, filter by club, venue, date and format, then register directly.",
  alternates: { canonical: "/events" },
};

function leagueDate(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T${end ? "23:59:59" : "00:00:00"}+03:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [settingsResult, registrationsResult, clubsResult, leaguesResult, followsResult] = await Promise.all([
    supabase.from("event_registration_settings").select("*").eq("registration_open", true).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(200),
    supabase.from("event_registrations").select("tournament_id, status").in("status", ["approved", "checked_in", "waitlisted"]).limit(10000),
    supabase.from("clubs").select("*").eq("is_public", true).order("name").limit(500),
    supabase.from("cloud_leagues").select("id, club_id, name, season, payload, is_public, updated_at").eq("is_public", true).order("updated_at", { ascending: false }).limit(200),
    user ? supabase.from("club_followers").select("club_id").eq("user_id", user.id).limit(500) : Promise.resolve({ data: [], error: null }),
  ]);

  const discoveryError = settingsResult.error || registrationsResult.error || clubsResult.error || leaguesResult.error;
  if (discoveryError) {
    console.error("Event discovery could not load", discoveryError);
    return (
      <main className="min-h-dvh bg-[#020617] text-white">
        <AppHeader />
        <div className="cb-shell py-10 sm:py-14">
          <DataLoadNotice title="Events are temporarily unavailable" detail="We could not confirm the latest tournaments and leagues, so CueBracket has not shown an incorrect empty calendar." />
        </div>
      </main>
    );
  }

  const clubs = (clubsResult.data ?? []) as ClubRow[];
  const clubMap = new Map(clubs.map((club) => [club.id, club]));
  const followed = new Set((followsResult.data ?? []).map((row) => row.club_id));
  const registrationCounts = new Map<string, { confirmed: number; waitlisted: number }>();
  for (const row of registrationsResult.data ?? []) {
    const counts = registrationCounts.get(row.tournament_id) ?? { confirmed: 0, waitlisted: 0 };
    if (row.status === "waitlisted") counts.waitlisted += 1;
    else counts.confirmed += 1;
    registrationCounts.set(row.tournament_id, counts);
  }

  const tournaments: DiscoveryEvent[] = ((settingsResult.data ?? []) as RegistrationSettingsRow[]).map((event) => {
    const club = event.club_id ? clubMap.get(event.club_id) : null;
    const counts = registrationCounts.get(event.tournament_id) ?? { confirmed: 0, waitlisted: 0 };
    return {
      id: event.tournament_id,
      type: "tournament",
      name: event.event_name,
      clubId: event.club_id,
      clubName: club?.name ?? "Independent organizer",
      clubSlug: club?.slug ?? null,
      venue: event.venue || club?.location || "Venue to be announced",
      format: event.format,
      raceTo: event.race_to,
      startsAt: event.scheduled_at,
      endsAt: null,
      entryFee: event.entry_fee,
      capacity: event.capacity,
      confirmed: counts.confirmed,
      waitlisted: counts.waitlisted,
      registrationOpen: event.registration_open,
      status: "upcoming",
      followed: Boolean(event.club_id && followed.has(event.club_id)),
      href: `/register/${event.tournament_id}`,
    };
  });

  const leagues: DiscoveryEvent[] = (leaguesResult.data ?? []).flatMap((row) => {
    const payload = row.payload as Partial<League> | null;
    if (!payload) return [];
    const club = row.club_id ? clubMap.get(row.club_id) : null;
    return [{
      id: row.id,
      type: "league" as const,
      name: row.name,
      clubId: row.club_id,
      clubName: club?.name ?? "Independent organizer",
      clubSlug: club?.slug ?? null,
      venue: payload.venue || club?.location || "Venue to be announced",
      format: payload.gameType || payload.format || "League",
      raceTo: Number(payload.raceTo) || 0,
      startsAt: leagueDate(payload.startDate),
      endsAt: leagueDate(payload.endDate, true),
      entryFee: "",
      capacity: null,
      confirmed: Array.isArray(payload.players) ? payload.players.length : 0,
      waitlisted: 0,
      registrationOpen: false,
      status: payload.status ?? "draft",
      followed: Boolean(row.club_id && followed.has(row.club_id)),
      href: `/league/${row.id}`,
    }];
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = sortDiscoveryEvents([...tournaments, ...leagues].filter((event) => {
    if (event.type === "league" && !["live", "completed"].includes(event.status)) return false;
    if (event.type === "league" && event.status === "completed") return false;
    const end = event.endsAt ?? event.startsAt;
    return !end || new Date(end).getTime() >= today.getTime();
  }));
  const followedCount = events.filter((event) => event.followed).length;

  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,.15),transparent_27rem),radial-gradient(circle_at_86%_0%,rgba(139,92,246,.13),transparent_25rem)]">
        <div className="cb-shell py-10 sm:py-14">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="cb-kicker">Discover pool events</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">Your next match starts here.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Explore upcoming pool tournaments and active leagues, see available places and move straight from discovery to registration.</p></div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[[events.length, "Upcoming"], [events.filter((event) => event.type === "tournament").length, "Open entry"], [followedCount, "Followed"]].map(([value, label]) => <div key={label} className="min-w-20 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-center"><p className="text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p></div>)}
            </div>
          </div>
        </div>
      </section>
      <div className="cb-shell py-7 sm:py-9">
        <EventDiscovery events={events} signedIn={Boolean(user)} />
      </div>
    </main>
  );
}
