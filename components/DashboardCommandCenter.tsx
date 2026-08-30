"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadDashboardData } from "@/lib/cloud/dashboard";
import { getLocalCloudOwner } from "@/lib/cloud/local-ownership";
import { dashboardDate, dashboardEvents, dashboardGreeting, dashboardLiveMatchCount, dashboardSafeHref, mergeDashboardRecords, upcomingDashboardEvents, type DashboardData, type DashboardEvent } from "@/lib/dashboard";
import { getLeagues, subscribeToLeagueChanges, type League } from "@/lib/leagues";
import { notificationIcon } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { getTournaments, subscribeToTournamentChanges, type Tournament } from "@/lib/tournaments";

const primaryButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300";
const secondaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.075]";
const panel = "min-w-0 rounded-3xl border border-white/10 bg-slate-900/65 p-5 sm:p-6";
const statuses = { live: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200", draft: "border-amber-300/20 bg-amber-300/10 text-amber-200", completed: "border-sky-300/20 bg-sky-300/10 text-sky-200" };

function Heading({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { href: string; label: string } }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="cb-kicker">{eyebrow}</p><h2 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">{title}</h2></div>{link ? <Link href={link.href} className="shrink-0 py-2 text-xs font-black text-cyan-300 hover:text-cyan-100">{link.label} →</Link> : null}</div>;
}

function Empty({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 p-6"><p className="font-bold text-slate-200">{title}</p><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>{href ? <Link href={href} className="mt-4 inline-flex min-h-11 items-center text-sm font-black text-cyan-300">{action} →</Link> : null}</div>;
}

function EventCard({ event }: { event: DashboardEvent }) {
  return <Link href={event.href} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 transition hover:border-cyan-300/30 sm:gap-4">
    <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black ${event.kind === "league" ? "bg-violet-300/10 text-violet-200" : "bg-cyan-300/10 text-cyan-200"}`}>{event.kind === "league" ? "L" : "8"}</span>
    <span className="min-w-0 flex-1"><span className="block truncate font-black text-white group-hover:text-cyan-100">{event.name}</span><span className="mt-1 block truncate text-xs text-slate-400">{event.detail}</span><span className="mt-1 block text-[0.65rem] text-slate-500">{event.total ? `${event.completed}/${event.total} results` : "Setup in progress"} · {dashboardDate(event.updatedAt)}</span></span>
    <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[0.6rem] font-black uppercase tracking-wider ${statuses[event.status]}`}>{event.status}</span>
  </Link>;
}

export function DashboardCommandCenter({ userId, displayName, initialNow }: { userId: string; displayName: string; initialNow: string }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [local, setLocal] = useState<{ tournaments: Tournament[]; leagues: League[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountValid, setAccountValid] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const supabase = createClient();
    const loadLocal = () => { if (active) setLocal({ tournaments: getTournaments(), leagues: getLeagues() }); };
    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const result = await loadDashboardData(userId);
        if (active) { setData(result); setError(""); setNow(new Date().toISOString()); loadLocal(); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Dashboard updates are unavailable. Try again.");
      } finally { inFlight = false; if (active) setLoading(false); }
    }
    const start = window.setTimeout(() => { loadLocal(); void refresh(); }, 0);
    const unsubscribeTournaments = subscribeToTournamentChanges(loadLocal);
    const unsubscribeLeagues = subscribeToLeagueChanges(loadLocal);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60000);
    const onFocus = () => { loadLocal(); void refresh(); };
    window.addEventListener("focus", onFocus);
    const channel = supabase.channel(`dashboard-inbox-${userId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void refresh()).subscribe();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        active = false;
        setAccountValid(false);
        setData(null);
        setLocal(null);
        router.refresh();
      }
    });
    return () => {
      active = false;
      window.clearTimeout(start); window.clearInterval(interval);
      unsubscribeTournaments(); unsubscribeLeagues(); subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshKey, router]);

  const tournaments = useMemo(() => mergeDashboardRecords(data?.tournaments ?? [], local?.tournaments ?? [], userId, getLocalCloudOwner), [data, local, userId]);
  const events = useMemo(() => dashboardEvents(tournaments,
    mergeDashboardRecords(data?.leagues ?? [], local?.leagues ?? [], userId, getLocalCloudOwner),
  ), [data, local, userId, tournaments]);
  const upcoming = useMemo(() => upcomingDashboardEvents(data?.events ?? [], now), [data, now]);
  const activeEvents = events.filter((event) => event.status !== "completed");
  const resume = activeEvents[0];
  const clubs = data?.clubs ?? [];
  const managedClubs = clubs.filter((club) => club.role === "owner" || club.role === "admin");
  const pendingClubs = managedClubs.filter((club) => (club.pendingRequests ?? 0) > 0);
  const membershipCount = managedClubs.reduce((count, club) => count + (club.pendingRequests ?? 0), 0);
  const requestsUnknown = !data || data.clubs === null || managedClubs.some((club) => club.pendingRequests === null);
  const activeLoaded = local !== null && data !== null && data.tournaments !== null && data.leagues !== null;
  const pendingMatches = events.reduce((count, event) => count + event.pendingMatches, 0);
  const playingTables = data?.tables?.filter((table) => table.status === "playing").length ?? 0;
  const liveMatches = dashboardLiveMatchCount(tournaments, data?.tables ?? []);
  const freeTables = data?.tables?.filter((table) => table.status === "available").length;
  const attentionCount = (data?.pendingRegistrations ?? 0) + membershipCount;
  const issues = data?.issues ?? [];
  const stats: Array<{ label: string; value: number | undefined | null; detail: string; href: string; tone: string }> = [
    { label: "Live matches", value: activeLoaded && data?.tables ? liveMatches : null, detail: activeLoaded ? `${events.filter((event) => event.status === "live").length} live events` : "Across your tournaments and tables", href: "#active-events", tone: "text-emerald-300" },
    { label: "Awaiting results", value: activeLoaded ? pendingMatches : null, detail: "Ready matches & league fixtures", href: "#active-events", tone: "text-cyan-300" },
    { label: "Confirmed entries", value: data?.confirmedRegistrations, detail: "Across your unfinished tournaments", href: "/tournaments", tone: "text-violet-300" },
    { label: "Free tables", value: freeTables, detail: data?.tables ? `${playingTables} playing · ${data.tables.filter((table) => table.status === "reserved").length} reserved` : "Your managed venue floor", href: "/tables", tone: "text-amber-300" },
  ];
  const quickActions = [
    ["Create tournament", "/tournaments/new", "+", "New draw"],
    ["Create league", "/leagues/new", "L", "Season & playoffs"],
    ["Open club", "#my-clubs", "8", "Your communities"],
    ["Manage tables", "/tables", "▦", "Venue floor"],
    ...(managedClubs.length ? [["Post update", managedClubs.length === 1 ? `/clubs/${managedClubs[0].slug}?tab=clubhouse` : "#my-clubs", "↗", "Club noticeboard"]] : [["Discover events", "/events", "↗", "Find your next game"]]),
  ];

  if (!accountValid) return <div className="cb-shell py-12" role="status">Updating your account…</div>;

  return <div className="cb-shell space-y-6 py-6 pb-14 sm:space-y-8 sm:py-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="cb-kicker">Your command center · {dashboardDate(now)} · EAT</p><h1 className="mt-2 break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">{dashboardGreeting(new Date(now))}, <span className="text-cyan-200">{displayName}.</span></h1><p className="mt-2 text-sm text-slate-400">{!data ? loading ? "Getting your events and clubs ready." : "Account updates are unavailable. Your saved events remain in the library." : attentionCount ? `${attentionCount} request${attentionCount === 1 ? " needs" : "s need"} your attention. Let’s keep things moving.` : resume ? "Your events, your people. Pick up where you left off." : "Your next pool night starts here."}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} className={`${secondaryButton} disabled:opacity-50`} aria-label="Refresh dashboard">{loading ? "Updating…" : "Refresh"}</button><Link href="/tournaments/new" className={primaryButton}>+ Create tournament</Link></div>
    </header>

    {error || issues.length ? <div role="status" className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-sm leading-6 text-amber-100">{error || `Some information is unavailable: ${issues.join(", ")}.`} <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} className="ml-1 font-black underline underline-offset-4">Retry</button>{data ? <span className="block text-xs text-amber-200/70">Last refresh: {dashboardDate(now, true)} EAT. Device-saved events remain available.</span> : null}</div> : null}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)]">
      <section className="relative min-w-0 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,.12),transparent_70%),linear-gradient(125deg,#102a43,#071425)] p-5 sm:p-7">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 to-blue-500" />
        <div className="flex items-center justify-between gap-3"><p className="cb-kicker">Continue where you stopped</p>{resume ? <span className={`rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase ${statuses[resume.status]}`}>{resume.status === "live" ? "● Live event" : "Draft"}</span> : <span className="text-xs font-bold text-cyan-200">Your next move</span>}</div>
        {!local ? <div className="mt-6 space-y-4" role="status"><p className="text-slate-400">Loading your saved events…</p><div className="h-7 w-3/4 animate-pulse rounded-lg bg-white/10" /><div className="h-12 w-40 animate-pulse rounded-xl bg-white/10" /></div> : resume ? <>
          <h2 className="mt-4 break-words text-2xl font-black tracking-tight sm:text-3xl">{resume.name}</h2><p className="mt-2 text-sm text-slate-300">{resume.detail}</p><p className="mt-1 text-xs text-slate-400">{resume.venue || "Venue not set"}</p>
          <div className="mt-5 flex items-center justify-between text-xs font-bold text-slate-300"><span>{resume.total ? `${resume.completed} of ${resume.total} current fixtures resolved` : "Add your players and generate the draw"}</span>{resume.liveMatches ? <span className="text-emerald-300">{resume.liveMatches} playing</span> : null}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/60" role="progressbar" aria-label="Current fixtures resolved" aria-valuemin={0} aria-valuemax={100} aria-valuenow={resume.total ? Math.round(resume.completed / resume.total * 100) : 0}><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-400" style={{ width: `${resume.total ? Math.min(100, resume.completed / resume.total * 100) : 0}%` }} /></div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href={resume.href} className={primaryButton}>{resume.status === "draft" ? "Continue setup" : resume.kind === "league" ? "Open league control" : "Continue scoring"} →</Link><Link href="#active-events" className={secondaryButton}>All active events</Link></div>
        </> : <><h2 className="mt-4 text-2xl font-black sm:text-3xl">{data ? "Ready for the next break?" : loading ? "Your saved events are loading" : "Open your saved events"}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">{data ? "Start a tournament, plan a league season or find an event to join. Your active events will appear here." : "Cloud events appear here once your account is connected. Your device-only drafts are available from the tournament library."}</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/tournaments/new" className={primaryButton}>Create an event →</Link><Link href={data ? "/events" : "/tournaments"} className={secondaryButton}>{data ? "Discover events" : "Tournament library"}</Link></div></>}
      </section>

      <section className={panel} id="dashboard-attention">
        <Heading eyebrow="Needs your attention" title="Keep the room moving" />
        <div className="space-y-2">
          <Attention href={data?.registrationEventIds[0] ? `/tournaments/${data.registrationEventIds[0]}` : "/tournaments"} value={data?.pendingRegistrations} title="Registration requests" detail="Review players waiting for approval" />
          <Attention href={pendingClubs[0] ? `/clubs/${pendingClubs[0].slug}?tab=members` : "#my-clubs"} value={requestsUnknown ? null : membershipCount} title="Membership requests" detail="Welcome new players into your clubs" />
          <Attention href="/notifications" value={data?.unreadCount} title="Unread notifications" detail="Club news and player updates" />
        </div>
        {data && attentionCount === 0 && !requestsUnknown && data.pendingRegistrations === 0 ? <p className="mt-4 text-xs font-bold text-emerald-300">✓ No registration or membership approvals waiting.</p> : null}
      </section>
    </div>

    <section aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{quickActions.map(([title, href, icon, detail]) => <Link key={title} href={href} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-3.5 transition hover:border-cyan-300/30"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-lg font-black text-cyan-200">{icon}</span><span><span className="block text-xs font-black text-slate-100 sm:text-sm">{title}</span><span className="mt-1 block text-[0.65rem] text-slate-400">{detail}</span></span></Link>)}</section>

    <section aria-label="Activity snapshot" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map((stat) => <Link key={stat.label} href={stat.href} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition hover:bg-slate-900"><p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">{stat.label}</p><p className={`mt-2 text-3xl font-black tabular-nums ${stat.tone}`}>{stat.value ?? "—"}</p><p className="mt-2 text-xs leading-5 text-slate-400">{stat.detail}</p></Link>)}</section>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,1fr)]">
      <div className="contents">
        <section className={`${panel} order-1`} id="active-events" style={{ scrollMarginTop: "6rem" }}>
          <Heading eyebrow="Event control" title="Active tournaments & leagues" link={{ href: "/tournaments", label: "Library" }} />
          {activeEvents.length ? <div className="space-y-3">{activeEvents.slice(0, 6).map((event) => <EventCard key={`${event.kind}:${event.id}`} event={event} />)}{activeEvents.length > 6 ? <p className="text-xs text-slate-400">Showing 6 of {activeEvents.length} active events. Open your tournament or league library for the rest.</p> : null}</div> : <Empty title={loading ? "Loading active events…" : !data || data.tournaments === null || data.leagues === null ? "Some events are unavailable" : "Nothing running right now"} text="Drafts and live events appear here, with a direct route back to scoring." href="/leagues" action="Open your leagues" />}
        </section>

        <section className={`${panel} order-3`} id="my-clubs" style={{ scrollMarginTop: "6rem" }}>
          <Heading eyebrow="Your communities" title="My clubs" link={{ href: "/clubs", label: "Browse clubs" }} />
          {clubs.length ? <div className="grid gap-3 sm:grid-cols-2">{clubs.map((club) => {
            const admin = club.role === "owner" || club.role === "admin";
            const clubEvents = upcoming.filter((event) => event.club_id === club.id);
            return <article key={club.id} className="min-w-0 overflow-hidden rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-300/[0.06] to-slate-950/50 p-4">
              <Link href={`/clubs/${club.slug}`} className="block"><div className="flex items-center justify-between gap-2"><span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg font-black text-violet-200">{club.name.charAt(0).toUpperCase()}</span><span className="rounded-full bg-white/5 px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-wider text-violet-200">{club.role}</span></div><h3 className="mt-4 break-words font-black text-white">{club.name}</h3><p className="mt-1 truncate text-xs text-slate-400">{club.location || "CueBracket club"}</p><p className="mt-3 text-xs text-slate-300">{club.memberCount ?? "—"} members · {data?.events ? clubEvents.length : "—"} upcoming events</p><span className="mt-4 inline-flex min-h-8 items-center text-xs font-black text-cyan-300">Open Command Center →</span></Link>
              {admin ? <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-3"><Link href={`/clubs/${club.slug}?tab=members`} className="rounded-lg border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-300">Members{club.pendingRequests ? ` · ${club.pendingRequests} pending` : ""}</Link><Link href={`/clubs/${club.slug}?tab=clubhouse`} className="rounded-lg bg-violet-300/10 px-3 py-2.5 text-xs font-bold text-violet-200">Post update</Link></div> : null}
            </article>;
          })}</div> : <Empty title={!data ? loading ? "Loading your clubs…" : "Club information unavailable" : data.clubs === null ? "Club information unavailable" : "Find your pool community"} text="Clubs you manage, belong to or follow will appear here. Club organizers can publish announcements from their Command Center." href="/clubs" action="Explore clubs" />}
        </section>

        <section className={`${panel} order-6 lg:order-5`}>
          <Heading eyebrow="Recently finished" title="Your latest results" link={{ href: "/hall-of-champions", label: "Champions" }} />
          {events.some((event) => event.status === "completed") ? <div className="space-y-3">{events.filter((event) => event.status === "completed").slice(0, 3).map((event) => <EventCard key={`${event.kind}:${event.id}`} event={event} />)}</div> : <Empty title="A space for your next champion" text="Completed tournaments and seasons will appear here for you to revisit." />}
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-black text-cyan-300"><Link href="/tournaments" className="py-2">Tournament history →</Link><Link href="/leagues" className="py-2">All league seasons →</Link></div>
        </section>
      </div>

      <div className="contents">
        <section className={`${panel} order-2`}>
          <Heading eyebrow="Your calendar" title="Coming up" link={{ href: "/events", label: "Discover" }} />
          {upcoming.length ? <div className="space-y-3">{upcoming.slice(0, 5).map((event) => <Link key={event.tournament_id} href={`/register/${event.tournament_id}`} className="block rounded-2xl border border-white/10 bg-slate-950/35 p-4 hover:border-cyan-300/30"><p className="text-xs font-black text-cyan-200">{dashboardDate(event.scheduled_at!, true)} EAT</p><h3 className="mt-2 font-black text-white">{event.event_name}</h3><p className="mt-1 text-xs text-slate-400">{event.venue || "Venue to be announced"}</p><div className="mt-3 flex items-center justify-between gap-2 text-[0.65rem] font-bold"><span className="truncate text-slate-400">{clubs.find((club) => club.id === event.club_id)?.name || "Your event"}</span><span className={event.registration_open ? "text-emerald-300" : "text-slate-400"}>{event.registration_open ? "Entries open →" : "View event →"}</span></div></Link>)}</div> : <Empty title={!data ? loading ? "Loading your calendar…" : "Calendar unavailable" : data.events === null ? "Calendar unavailable" : "Your calendar is clear"} text="Upcoming events you organize, enter or follow through a club will show here." href="/events" action="Find an event" />}
        </section>

        <section className={`${panel} order-4`}>
          <Heading eyebrow="Stay in the loop" title="Latest notifications" link={{ href: "/notifications", label: "Inbox" }} />
          {data?.notifications?.length ? <div className="divide-y divide-white/10">{data.notifications.map((notification) => <Link key={notification.id} href={dashboardSafeHref(notification.href)} className="flex gap-3 py-4 first:pt-0 last:pb-0"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5">{notificationIcon(notification.type)}</span><span className="min-w-0 flex-1"><span className="flex items-start gap-2"><span className="text-sm font-bold text-slate-100">{notification.title}</span>{!notification.read_at ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"><span className="sr-only">Unread</span></span> : null}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{notification.message}</span><span className="mt-2 block text-[0.65rem] text-slate-500">{dashboardDate(notification.created_at, true)} EAT</span></span></Link>)}</div> : <Empty title={!data ? loading ? "Loading your inbox…" : "Inbox unavailable" : data.notifications === null ? "Inbox unavailable" : "You’re all caught up"} text="Club news, registration updates and live-match alerts appear here." />}
        </section>

        <section className={`${panel} order-5 lg:order-6`}>
          <Heading eyebrow="Venue floor" title="Table snapshot" link={{ href: "/tables", label: "Manage" }} />
          {data?.tables?.length ? <div className="space-y-2">{data.tables.slice(0, 5).map((table) => <Link key={table.id} href="/tables" className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-bold">{table.name}</span><span className="mt-1 block truncate text-xs text-slate-400">{table.active_match_label || table.note || "Ready for the next match"}</span></span><span className={`text-[0.65rem] font-black uppercase ${table.status === "available" ? "text-emerald-300" : table.status === "playing" ? "text-cyan-300" : "text-amber-300"}`}>{table.status === "available" ? "Free" : table.status}</span></Link>)}</div> : <Empty title={!data ? loading ? "Loading your tables…" : "Table information unavailable" : data.tables === null ? "Table information unavailable" : "Set up your venue"} text="Add tables to see availability and assignments at a glance." href="/tables" action="Open table control" />}
        </section>

        <Link href="/cloud" className="order-7 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5 lg:col-span-2"><span><span className="block text-sm font-black">Cloud & backups</span><span className="mt-1 block text-xs text-slate-400">Check sync health, privacy and spectator links</span></span><span className="text-cyan-300">→</span></Link>
      </div>
    </div>
  </div>;
}

function Attention({ href, value, title, detail }: { href: string; value: number | null | undefined; title: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/35 p-3.5 transition hover:border-cyan-300/25"><span className={`grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-2 text-lg font-black tabular-nums ${value ? "bg-amber-300/10 text-amber-200" : "bg-white/5 text-slate-400"}`}>{value ?? "—"}</span><span className="min-w-0"><span className="block text-sm font-bold text-slate-100">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span></span><span aria-hidden="true" className="ml-auto text-slate-500">→</span></Link>;
}
