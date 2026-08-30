"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ClubAnnouncementBoard } from "@/components/ClubAnnouncementBoard";
import { ClubCommunityPanel, type ClubMemberView } from "@/components/ClubCommunityPanel";
import { ClubGuide } from "@/components/ClubGuide";
import { LiveMatchFeed } from "@/components/LiveMatchFeed";
import { FollowPlayerButton, PlayerFollowingProvider } from "@/components/PlayerFollowing";
import { TableManager } from "@/components/TableManager";
import type { ClubMembershipRequestRow, ClubRole, ClubRow } from "@/lib/clubs";
import {
  clubAnnouncementLabel,
  clubDateLabel,
  type ClubAnnouncementRow,
  type ClubLeagueSummary,
  type ClubRegistrationCount,
  type ClubTournamentSummary,
} from "@/lib/club-command-center";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import type { ClubPlayerRankingRow } from "@/lib/rankings";

type ClubTab = "home" | "live" | "events" | "rankings" | "members" | "clubhouse";
type EventFilter = "all" | "open" | "live" | "finished";

interface Props {
  initialTab?: string;
  club: ClubRow;
  userId: string | null;
  isAdmin: boolean;
  isFollowing: boolean;
  followerCount: number;
  ownRole: ClubRole | null;
  ownRequest: ClubMembershipRequestRow | null;
  pendingRequests: ClubMembershipRequestRow[];
  members: ClubMemberView[];
  defaultRequestName: string;
  tournaments: ClubTournamentSummary[];
  registrationSettings: RegistrationSettingsRow[];
  registrationCounts: ClubRegistrationCount[];
  leagues: ClubLeagueSummary[];
  rankings: ClubPlayerRankingRow[];
  announcements: ClubAnnouncementRow[];
  tableCounts: { available: number; playing: number; reserved: number };
}

const tabs: Array<{ id: ClubTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "live", label: "Live now" },
  { id: "events", label: "Events" },
  { id: "rankings", label: "Rankings" },
  { id: "members", label: "Members" },
  { id: "clubhouse", label: "Clubhouse" },
];

const statusStyle = {
  draft: "border-slate-300/15 bg-slate-300/[0.07] text-slate-300",
  live: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  completed: "border-blue-300/20 bg-blue-300/10 text-blue-200",
};

function cleanLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function StatCard({ value, label, detail, tone = "cyan" }: { value: number | string; label: string; detail: string; tone?: "cyan" | "emerald" | "violet" | "amber" }) {
  const tones = {
    cyan: "from-cyan-400/20 text-cyan-200",
    emerald: "from-emerald-400/20 text-emerald-200",
    violet: "from-violet-400/20 text-violet-200",
    amber: "from-amber-400/20 text-amber-200",
  };
  return <article className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tones[tone]} to-slate-950/65 p-4 sm:p-5`}><p className="text-3xl font-black text-white">{value}</p><p className="mt-2 text-xs font-black uppercase tracking-[0.16em]">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>;
}

export function ClubCommandCenter(props: Props) {
  const {
    club, userId, isAdmin, isFollowing, ownRole, ownRequest, pendingRequests,
    members, defaultRequestName, tournaments, registrationSettings,
    registrationCounts, leagues, rankings, announcements, tableCounts,
  } = props;
  const [activeTab, setActiveTab] = useState<ClubTab>(() => tabs.find((tab) => tab.id === props.initialTab)?.id ?? "home");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [rankingQuery, setRankingQuery] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const settingsById = useMemo(() => new Map(registrationSettings.map((item) => [item.tournament_id, item])), [registrationSettings]);
  const countsById = useMemo(() => new Map(registrationCounts.map((item) => [item.tournamentId, item])), [registrationCounts]);
  const openEvents = registrationSettings.filter((item) => item.registration_open);
  const liveTournaments = tournaments.filter((item) => item.status === "live");
  const completedTournaments = tournaments.filter((item) => item.status === "completed");
  const liveLeagues = leagues.filter((item) => item.payload?.status === "live");
  const pinnedAnnouncement = announcements.find((item) => item.is_pinned) ?? announcements[0] ?? null;
  const nextEvent = [...openEvents].sort((a, b) => {
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return a.scheduled_at.localeCompare(b.scheduled_at);
  })[0] ?? null;
  const totalTitles = rankings.reduce((sum, player) => sum + player.titles, 0);
  const initial = club.name.charAt(0).toUpperCase();

  const visibleMembers = members.filter((member) => `${member.name} ${member.username ?? ""} ${member.role}`.toLowerCase().includes(memberQuery.trim().toLowerCase()));
  const visibleRankings = rankings.filter((player) => `${player.tournament_name ?? ""} ${player.display_name} ${player.username ?? ""}`.toLowerCase().includes(rankingQuery.trim().toLowerCase()));
  const visibleTournaments = tournaments.filter((item) => {
    const settings = settingsById.get(item.id);
    if (eventFilter === "open") return settings?.registration_open === true;
    if (eventFilter === "live") return item.status === "live";
    if (eventFilter === "finished") return item.status === "completed";
    return true;
  });

  function chooseTab(tab: ClubTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    window.requestAnimationFrame(() => document.getElementById("club-command-content")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function shareClub() {
    const url = window.location.href;
    setShareMessage("");
    try {
      if (navigator.share) await navigator.share({ title: `${club.name} on CueBracket`, text: `Follow ${club.name}, see events and join the club.`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Club link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Copy the page link from your browser to share this club.");
    }
  }

  return (
    <PlayerFollowingProvider><div className="pb-16">
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.22),transparent_28rem),radial-gradient(circle_at_90%_12%,rgba(59,130,246,.16),transparent_26rem),linear-gradient(180deg,#0a1a2d,#06101f)]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(125,211,252,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.08)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="cb-shell relative py-7 sm:py-11">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <div className={`relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.6rem] border border-cyan-200/25 bg-[linear-gradient(145deg,rgba(34,211,238,.2),rgba(37,99,235,.12))] bg-cover bg-center text-3xl font-black text-cyan-100 shadow-2xl shadow-cyan-950/40 sm:h-28 sm:w-28 sm:text-5xl`} style={club.logo_url ? { backgroundImage: `url("${club.logo_url.replaceAll('"', "%22")}")` } : undefined}>
                {club.logo_url ? <span className="sr-only">{club.name} logo</span> : initial}
                <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-[#0a1a2d] bg-emerald-400" />
              </div>
              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="cb-kicker">Club Command Center</p>
                  {isAdmin ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-wider text-amber-200">Organizer view</span> : null}
                </div>
                <h1 className="mt-2 break-words text-4xl font-black tracking-[-0.05em] sm:text-6xl">{club.name}</h1>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-400"><span>{club.location ? `📍 ${club.location}` : "CueBracket pool club"}</span><span className="text-slate-600">/clubs/{club.slug}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button type="button" onClick={() => void shareClub()} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white hover:bg-white/[0.09]">{shareMessage || "Share club"}</button>
              <button type="button" onClick={() => chooseTab("members")} className="min-h-12 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">{ownRole ? "Open member area" : isFollowing ? "Following · Join club" : "Follow or join"}</button>
            </div>
          </div>
          {club.description ? <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{club.description}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-black text-slate-300"><span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-2">{members.length} members</span><span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-2">{props.followerCount} followers{props.isFollowing ? " · You follow" : ""}</span><span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-emerald-200">{openEvents.length} open registration{openEvents.length === 1 ? "" : "s"}</span></div>
        </div>
      </section>

      <nav aria-label="Club sections" className="sticky top-16 z-30 border-b border-white/10 bg-[#06101f]/95 shadow-xl shadow-black/20 backdrop-blur-xl sm:top-[4.5rem]">
        <div className="cb-shell flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => chooseTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`relative min-h-14 shrink-0 px-4 text-sm font-black transition sm:min-h-16 sm:px-6 ${activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-200"}`}>{tab.label}{activeTab === tab.id ? <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" /> : null}</button>)}
        </div>
      </nav>

      <div id="club-command-content" className="cb-shell scroll-mt-36 py-6 sm:scroll-mt-40 sm:py-9">
        {activeTab === "home" ? (
          <div className="space-y-6">
            {pinnedAnnouncement ? <button type="button" onClick={() => chooseTab("clubhouse")} className="group w-full overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(100deg,rgba(8,47,73,.8),rgba(15,23,42,.72))] text-left"><div className="flex items-stretch"><span className="w-1.5 shrink-0 bg-gradient-to-b from-cyan-300 to-blue-500" /><span className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><span className="min-w-0"><span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-300">{pinnedAnnouncement.is_pinned ? "Pinned notice" : "Latest notice"} · {clubAnnouncementLabel(pinnedAnnouncement.kind)}</span><span className="mt-1 block truncate font-black text-white">{pinnedAnnouncement.title}</span></span><span className="shrink-0 text-xs font-black text-cyan-300 group-hover:text-cyan-200">Open noticeboard →</span></span></div></button> : null}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard value={openEvents.length} label="Open events" detail="Accepting registrations" tone="cyan" />
              <StatCard value={liveTournaments.length + liveLeagues.length} label="Live now" detail="Tournaments and leagues" tone="emerald" />
              <StatCard value={members.length} label="Members" detail={`${rankings.length} ranked players`} tone="violet" />
              <StatCard value={isAdmin ? tableCounts.available : totalTitles} label={isAdmin ? "Free tables" : "Club titles"} detail={isAdmin ? `${tableCounts.playing} currently playing` : "Verified CueBracket titles"} tone="amber" />
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
              <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.12),transparent_22rem),linear-gradient(145deg,rgba(15,30,51,.9),rgba(3,9,21,.94))] p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="cb-kicker">Next at the club</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{nextEvent?.event_name ?? (liveTournaments[0]?.name || "The next match is yours")}</h2></div>{nextEvent ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">Registration open</span> : null}</div>
                {nextEvent ? <><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-600">Date & time</p><p className="mt-2 text-sm font-black text-white">{clubDateLabel(nextEvent.scheduled_at)}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-600">Venue</p><p className="mt-2 text-sm font-black text-white">{nextEvent.venue || club.location || "To be announced"}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-600">Format</p><p className="mt-2 text-sm font-black capitalize text-white">{cleanLabel(nextEvent.format)} · Race to {nextEvent.race_to}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><Link href={`/register/${nextEvent.tournament_id}`} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950">Register now →</Link><button type="button" onClick={() => chooseTab("events")} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300">All club events</button></div></> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-7"><p className="text-sm leading-6 text-slate-500">No registration is open right now. Follow the club and watch the noticeboard for the next announcement.</p>{isAdmin ? <Link href="/tournaments/new" className="mt-4 inline-flex rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950">Create the next event</Link> : null}</div>}
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><p className="cb-kicker">Club pulse</p><h2 className="mt-2 text-xl font-black">Right now</h2></div><span className="cb-live-dot" /></div>
                <div className="mt-5 space-y-3">{[[liveTournaments.length, "Live tournaments", "text-emerald-300"], [liveLeagues.length, "Live league seasons", "text-violet-300"], [openEvents.length, "Open entries", "text-cyan-300"], [isAdmin ? pendingRequests.length : announcements.length, isAdmin ? "Membership requests" : "Club announcements", "text-amber-300"]].map(([value, label, color]) => <div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-950/40 px-4 py-3"><span className="text-sm font-bold text-slate-400">{label}</span><span className={`text-lg font-black ${color}`}>{value}</span></div>)}</div>
              </section>
            </div>

            {isAdmin ? <AdminQuickActions chooseTab={chooseTab} /> : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7"><div className="flex items-end justify-between"><div><p className="cb-kicker">Form table</p><h2 className="mt-2 text-2xl font-black">Club leaders</h2></div><button type="button" onClick={() => chooseTab("rankings")} className="text-sm font-black text-cyan-300">Full table →</button></div><RankingList rankings={rankings.slice(0, 5)} /></section>
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7"><div className="flex items-end justify-between"><div><p className="cb-kicker">League room</p><h2 className="mt-2 text-2xl font-black">Current seasons</h2></div><button type="button" onClick={() => chooseTab("clubhouse")} className="text-sm font-black text-violet-300">Clubhouse →</button></div><LeagueList leagues={leagues.slice(0, 4)} /></section>
            </div>
          </div>
        ) : null}

        {activeTab === "live" ? <LiveMatchFeed clubId={club.id} /> : null}

        {activeTab === "events" ? (
          <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker">Club calendar</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Tournaments & events</h2><p className="mt-2 text-sm text-slate-500">Registration, live brackets and completed club history in one place.</p></div>{isAdmin ? <Link href="/tournaments/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950">+ Create tournament</Link> : null}</div>
            <div className="mt-6 flex overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/65 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(["all", "open", "live", "finished"] as EventFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setEventFilter(filter)} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-black capitalize ${eventFilter === filter ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>{filter} {filter === "all" ? tournaments.length : filter === "open" ? openEvents.length : filter === "live" ? liveTournaments.length : completedTournaments.length}</button>)}</div>
            {visibleTournaments.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{visibleTournaments.map((item) => <TournamentCard key={item.id} item={item} settings={settingsById.get(item.id)} counts={countsById.get(item.id)} />)}</div> : <div className="mt-5 rounded-[2rem] border border-dashed border-white/10 py-14 text-center"><p className="text-xl font-black text-slate-300">No events in this view</p><p className="mt-2 text-sm text-slate-600">Choose another filter or create the club’s next tournament.</p></div>}
            <div className="mt-9 flex items-end justify-between gap-3"><div><p className="cb-kicker">League calendar</p><h2 className="mt-2 text-2xl font-black">Seasons & playoffs</h2></div>{isAdmin ? <Link href="/leagues/new" className="text-sm font-black text-violet-300">Create season →</Link> : null}</div><div className="mt-4 grid gap-4 lg:grid-cols-2"><LeagueList leagues={leagues} cards /></div>
          </section>
        ) : null}

        {activeTab === "rankings" ? (
          <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker">Verified club rankings</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">The club table</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Match wins, podiums and titles from cloud-synced CueBracket tournaments.</p></div><label className="relative sm:w-72"><span className="sr-only">Search rankings</span><input value={rankingQuery} onChange={(event) => setRankingQuery(event.target.value)} placeholder="Search a player" className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-900/75 px-4 text-sm font-bold text-white outline-none focus:border-cyan-300/40" /></label></div>
            {rankings.length >= 3 && !rankingQuery ? <div className="mt-7 grid gap-3 sm:grid-cols-3">{rankings.slice(0, 3).map((player, index) => <PodiumCard key={player.profile_id} player={player} index={index} />)}</div> : null}
            <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60"><div className="hidden grid-cols-[4rem_minmax(0,1fr)_repeat(5,5rem)] gap-3 border-b border-white/10 px-5 py-3 text-[0.62rem] font-black uppercase tracking-wider text-slate-600 md:grid"><span>Rank</span><span>Player</span><span>Played</span><span>Won</span><span>Diff</span><span>Titles</span><span>Points</span></div><RankingList rankings={visibleRankings} detailed /></div>
          </section>
        ) : null}

        {activeTab === "members" ? (
          <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker">Club people</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Members & invitations</h2><p className="mt-2 text-sm text-slate-500">Find players, join the roster and manage trusted club roles.</p></div><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search members" aria-label="Search club members" className="min-h-12 rounded-xl border border-white/10 bg-slate-900/75 px-4 text-sm font-bold text-white outline-none focus:border-cyan-300/40 sm:w-72" /></div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)] lg:items-start"><div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleMembers.map((member) => <MemberCard key={member.userId} member={member} />)}</div>{!visibleMembers.length ? <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-slate-500">No members match that search.</div> : null}</div><InviteCard club={club} chooseTab={chooseTab} /></div>
            <div className="mt-7"><ClubCommunityPanel club={club} userId={userId} isFollowing={isFollowing} ownRole={ownRole} ownRequest={ownRequest} pendingRequests={pendingRequests} members={members} defaultRequestName={defaultRequestName} isAdmin={isAdmin} /></div>
          </section>
        ) : null}

        {activeTab === "clubhouse" ? (
          <div className="space-y-6">
            <div><p className="cb-kicker">Inside the clubhouse</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">News, leagues & venue</h2><p className="mt-2 text-sm text-slate-500">Everything that keeps the club moving between tournament days.</p></div>
            <ClubGuide clubId={club.id} isAdmin={isAdmin} location={club.location} />
            <ClubAnnouncementBoard key={announcements.map((item) => item.updated_at).join("|")} clubId={club.id} initialAnnouncements={announcements} isAdmin={isAdmin} />
            <section className="rounded-[2rem] border border-violet-300/15 bg-slate-900/60 p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="cb-kicker !text-violet-300">League room</p><h2 className="mt-2 text-2xl font-black">Club seasons</h2></div>{isAdmin ? <Link href="/leagues/new" className="text-sm font-black text-violet-300">+ New season</Link> : null}</div><div className="mt-5 grid gap-4 lg:grid-cols-2"><LeagueList leagues={leagues} cards /></div></section>
            {isAdmin ? <TableManager clubId={club.id} /> : <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6"><p className="cb-kicker">Venue operations</p><div className="mt-3 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black">The live table floor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Club organizers use this area to assign tables and keep matches moving in realtime.</p></div><span className="hidden rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-center sm:block"><span className="block text-2xl font-black text-cyan-300">Live</span><span className="text-[0.6rem] font-black uppercase text-slate-600">Organizer managed</span></span></div></section>}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard value={completedTournaments.length} label="Events played" detail="Completed club tournaments" /><StatCard value={totalTitles} label="Titles won" detail="Verified club champions" tone="amber" /><StatCard value={leagues.length} label="League seasons" detail="Current and previous seasons" tone="violet" /><StatCard value={announcements.length} label="Club updates" detail="Published announcements" tone="emerald" /></section>
            {isAdmin ? <AdminQuickActions chooseTab={chooseTab} /> : null}
          </div>
        ) : null}
      </div>
    </div></PlayerFollowingProvider>
  );
}

function AdminQuickActions({ chooseTab }: { chooseTab: (tab: ClubTab) => void }) {
  const actions = [
    ["Create tournament", "/tournaments/new", "New bracket and registration"],
    ["Create league", "/leagues/new", "Season, fixtures and playoffs"],
    ["Manage tables", "/tables", "Venue floor and assignments"],
  ];
  return <section className="rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,47,73,.38),rgba(15,23,42,.7))] p-5 sm:p-7"><div className="flex items-end justify-between"><div><p className="cb-kicker">Organizer launchpad</p><h2 className="mt-2 text-2xl font-black">Quick actions</h2></div><span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-wider text-cyan-200">Manage club</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{actions.map(([label, href, detail]) => <Link key={label} href={href} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/25"><span className="font-black text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span></Link>)}<button type="button" onClick={() => chooseTab("members")} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left transition hover:border-cyan-300/25"><span className="font-black">Invite members</span><span className="mt-1 block text-xs leading-5 text-slate-600">Share link and approve requests</span></button><button type="button" onClick={() => chooseTab("clubhouse")} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left transition hover:border-cyan-300/25"><span className="font-black">Post update</span><span className="mt-1 block text-xs leading-5 text-slate-600">Publish to the noticeboard</span></button></div></section>;
}

function TournamentCard({ item, settings, counts }: { item: ClubTournamentSummary; settings?: RegistrationSettingsRow; counts?: ClubRegistrationCount }) {
  const confirmed = counts?.confirmed ?? 0;
  const capacity = settings?.capacity ?? item.bracket_size;
  const spaces = Math.max(0, capacity - confirmed);
  const href = settings?.registration_open ? `/register/${item.id}` : `/live/${item.id}`;
  return <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,30,51,.88),rgba(3,9,21,.95))]"><div className={`h-1 ${item.status === "live" ? "bg-emerald-400" : item.status === "completed" ? "bg-blue-400" : "bg-cyan-400"}`} /><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-wider ${statusStyle[item.status]}`}>{item.status === "live" ? "● Live" : item.status}</span><h3 className="mt-3 text-xl font-black text-white">{item.name}</h3><p className="mt-1 text-sm font-bold text-slate-500">{item.venue || "Venue TBA"}</p></div><div className="shrink-0 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-center"><p className="font-black text-white">R{item.race_to}</p><p className="text-[0.55rem] font-black uppercase text-slate-600">Race</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/8 bg-white/[0.025] p-3"><p className="text-[0.6rem] font-black uppercase text-slate-600">Date</p><p className="mt-1 text-sm font-black text-slate-300">{clubDateLabel(settings?.scheduled_at)}</p></div><div className="rounded-xl border border-white/8 bg-white/[0.025] p-3"><p className="text-[0.6rem] font-black uppercase text-slate-600">Format</p><p className="mt-1 text-sm font-black capitalize text-slate-300">{cleanLabel(item.format)}</p></div></div>{settings?.registration_open ? <div className="mt-4"><div className="flex justify-between text-xs font-bold"><span className="text-slate-500">{confirmed}/{capacity} confirmed</span><span className={spaces ? "text-emerald-300" : "text-amber-300"}>{spaces ? `${spaces} spaces left` : "Waitlist"}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.min(100, capacity ? confirmed / capacity * 100 : 0)}%` }} /></div></div> : null}<div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-600">{settings?.entry_fee || `${item.bracket_size} player bracket`}</p><Link href={href} className={`rounded-xl px-4 py-2.5 text-sm font-black ${settings?.registration_open ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-200"}`}>{settings?.registration_open ? "Register →" : "View →"}</Link></div></div></article>;
}

function RankingList({ rankings, detailed = false }: { rankings: ClubPlayerRankingRow[]; detailed?: boolean }) {
  if (!rankings.length) return <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">Verified club results will build this table automatically.</div>;
  return <div className={detailed ? "divide-y divide-white/8" : "mt-5 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40"}>{rankings.map((player) => <RankedPlayerRow key={player.profile_id} player={player} detailed={detailed} />)}</div>;
}

function PodiumCard({ player, index }: { player: ClubPlayerRankingRow; index: number }) {
  const className = `rounded-[1.75rem] border p-5 text-center ${index === 0 ? "border-amber-300/25 bg-amber-300/[0.07] sm:-translate-y-2" : "border-white/10 bg-slate-900/65"}`;
  const content = <><p className="text-3xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</p><p className="mt-3 truncate text-lg font-black">{player.tournament_name || player.display_name}</p><p className="mt-1 text-xs font-bold text-slate-500">{player.wins} wins · {player.titles} titles</p><p className="mt-3 text-xl font-black text-cyan-300">{player.ranking_points} pts</p></>;
  return player.username ? <Link href={`/players/${player.username}`} className={className}>{content}</Link> : <article className={className}>{content}</article>;
}

function RankedPlayerRow({ player, detailed }: { player: ClubPlayerRankingRow; detailed: boolean }) {
  const className = detailed ? "grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 hover:bg-white/[0.035] md:grid-cols-[4rem_minmax(0,1fr)_repeat(5,5rem)] md:px-5" : "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-white/[0.035]";
  const content = <><span className="font-black text-slate-500">#{player.club_rank}</span><span className="min-w-0"><span className="block truncate font-black text-white">{player.tournament_name || player.display_name}</span><span className="mt-0.5 block text-xs font-bold text-slate-600">{player.username ? `@${player.username}` : `${player.wins}–${player.losses}`}</span></span>{detailed ? <><span className="hidden text-center text-sm font-bold text-slate-400 md:block">{player.matches_played}</span><span className="hidden text-center text-sm font-bold text-slate-400 md:block">{player.wins}</span><span className="hidden text-center text-sm font-bold text-slate-400 md:block">{player.frame_difference > 0 ? "+" : ""}{player.frame_difference}</span><span className="hidden text-center text-sm font-bold text-slate-400 md:block">{player.titles}</span></> : null}<span className="text-right font-black text-cyan-300">{player.ranking_points}<span className="ml-1 text-[0.55rem] uppercase text-slate-600">pts</span></span></>;
  return player.username ? <Link href={`/players/${player.username}`} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function LeagueList({ leagues, cards = false }: { leagues: ClubLeagueSummary[]; cards?: boolean }) {
  if (!leagues.length) return <div className={`${cards ? "lg:col-span-2" : "mt-5"} rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500`}>No club league season has been published yet.</div>;
  return <>{leagues.map((item) => <Link key={item.id} href={`/league/${item.id}`} className={`${cards ? "" : "mt-3 first:mt-5"} block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-violet-300/25`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-white">{item.name}</p><p className="mt-1 text-xs font-bold text-slate-600">{item.payload?.players?.length ?? 0} players · {item.payload?.fixtures?.filter((fixture) => fixture.completed).length ?? 0} results</p></div><span className="rounded-full border border-violet-300/15 bg-violet-300/10 px-2.5 py-1 text-[0.6rem] font-black text-violet-200">{item.season}</span></div><div className="mt-4 flex items-center justify-between text-xs font-bold"><span className="capitalize text-slate-500">{item.payload?.gameType ? cleanLabel(item.payload.gameType) : "League"} · {item.payload?.status ?? "draft"}</span><span className="text-violet-300">{item.payload?.playoff?.enabled ? `Top ${item.payload.playoff.qualifierCount} playoffs` : "League table"} →</span></div></Link>)}</>;
}

function MemberCard({ member }: { member: ClubMemberView }) {
  const content = <><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-300/15 to-blue-500/10 text-lg font-black text-cyan-100">{member.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{member.name}</span><span className="mt-1 block truncate text-xs font-bold text-slate-600">{member.username ? `@${member.username}` : "CueBracket member"}</span></span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-wider text-slate-400">{member.role}</span></>;
  return <article className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">{member.username ? <Link href={`/players/${member.username}`} className="flex items-center gap-3">{content}</Link> : <div className="flex items-center gap-3">{content}</div>}{member.isPublic && member.username ? <FollowPlayerButton playerId={member.userId} profile={{ id: member.userId, username: member.username, display_name: member.name, tournament_name: member.name, is_public: true }} /> : <p className="text-xs text-slate-500">A public player profile is needed to follow.</p>}</article>;
}

function InviteCard({ club, chooseTab }: { club: ClubRow; chooseTab: (tab: ClubTab) => void }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Invite link copied"); }
    catch { setMessage("Copy this page link from your browser"); }
  }
  return <aside className="rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_16rem),rgba(15,23,42,.7)] p-5 sm:p-6"><p className="cb-kicker">Grow the club</p><h3 className="mt-2 text-2xl font-black">Invite players in one tap.</h3><p className="mt-3 text-sm leading-6 text-slate-400">Share this club page. Players can follow {club.name}, request membership and register for open events.</p><div className="mt-5 rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-xs font-bold text-slate-500">/clubs/{club.slug}</div><button type="button" onClick={() => void copy()} className="mt-3 min-h-12 w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">{message || "Copy invite link"}</button><button type="button" onClick={() => chooseTab("events")} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300">Show upcoming events</button></aside>;
}
