"use client";

import Link from "next/link";
import { useState } from "react";

import { ClubAchievementWall } from "@/components/ClubAchievementWall";
import { ClubAnnouncementBoard } from "@/components/ClubAnnouncementBoard";
import { ClubCalendarBoard } from "@/components/ClubCalendarBoard";
import { ClubCommunityPanel, type ClubMemberView } from "@/components/ClubCommunityPanel";
import { ClubCommunicationCenter } from "@/components/ClubCommunicationCenter";
import { ClubGuide } from "@/components/ClubGuide";
import { ClubGallery } from "@/components/ClubGallery";
import { ClubModerationCenter } from "@/components/ClubModerationCenter";
import { ClubPracticeBoard } from "@/components/ClubPracticeBoard";
import { DataLoadNotice } from "@/components/DataLoadNotice";
import { TableManager } from "@/components/TableManager";
import type { ClubGuideRow, ClubMembershipRequestRow, ClubRole, ClubRow } from "@/lib/clubs";
import type {
  ClubAchievementRow,
  ClubAnnouncementRow,
  ClubCalendarEventRow,
  ClubCalendarRsvpRow,
  ClubChallengeRow,
  ClubGalleryItemRow,
  ClubMemberBlockRow,
  ClubMemberReportRow,
  ClubMemberRestrictionRow,
} from "@/lib/club-command-center";
import type { ClubBroadcastRow } from "@/lib/club-communications";

type AdminSection = "overview" | "people" | "content" | "operations";

interface Props {
  initialSection?: string;
  club: ClubRow;
  userId: string;
  role: Extract<ClubRole, "owner" | "admin">;
  guide: ClubGuideRow | null;
  members: ClubMemberView[];
  pendingRequests: ClubMembershipRequestRow[];
  pendingRequestsError: boolean;
  announcements: ClubAnnouncementRow[];
  calendarEvents: ClubCalendarEventRow[];
  calendarRsvps: ClubCalendarRsvpRow[];
  challenges: ClubChallengeRow[];
  achievements: ClubAchievementRow[];
  galleryItems: ClubGalleryItemRow[];
  reports: ClubMemberReportRow[];
  restrictions: ClubMemberRestrictionRow[];
  blocks: ClubMemberBlockRow[];
  broadcasts: ClubBroadcastRow[];
  followerCount: number;
  liveEventCount: number;
}

const sections: Array<{ id: AdminSection; label: string; detail: string }> = [
  { id: "overview", label: "Overview", detail: "Priorities and shortcuts" },
  { id: "people", label: "People", detail: "Requests, roles and details" },
  { id: "content", label: "Content", detail: "Calendar, news and honours" },
  { id: "operations", label: "Operations", detail: "Guide, practice and tables" },
];

function SummaryCard({ value, label, detail, tone }: { value: number | null; label: string; detail: string; tone: string }) {
  return <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5"><p className={`text-3xl font-black ${tone}`}>{value ?? "—"}</p><p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-white">{label}</p><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p></article>;
}

export function ClubAdminWorkspace(props: Props) {
  const initial = sections.find((item) => item.id === props.initialSection)?.id ?? "overview";
  const [activeSection, setActiveSection] = useState<AdminSection>(initial);
  const memberNames = Object.fromEntries(props.members.map((member) => [member.userId, member.name]));
  const upcomingCount = props.calendarEvents.filter((event) => !event.is_cancelled && new Date(event.starts_at) > new Date()).length;
  const openChallengeCount = props.challenges.filter((challenge) => challenge.status === "open").length;

  function chooseSection(section: AdminSection) {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    window.history.replaceState(null, "", url);
    window.requestAnimationFrame(() => document.getElementById("club-admin-content")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <div className="pb-16">
    <header className="border-b border-amber-300/15 bg-[radial-gradient(circle_at_10%_0%,rgba(251,191,36,.15),transparent_28rem),radial-gradient(circle_at_90%_0%,rgba(34,211,238,.12),transparent_24rem),linear-gradient(180deg,#111827,#06101f)]">
      <div className="cb-shell py-7 sm:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Private organizer workspace</p><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-slate-300">{props.role}</span></div>
            <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.04em] sm:text-5xl">Manage {props.club.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Approvals, publishing and venue work live here. Members only see the polished public club page.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/clubs/${props.club.slug}`} className="inline-flex min-h-12 items-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10">View member page →</Link><Link href="/dashboard" className="inline-flex min-h-12 items-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300">Dashboard</Link></div>
        </div>
      </div>
    </header>

    <nav aria-label="Club management sections" className="sticky top-16 z-30 border-b border-white/10 bg-[#06101f]/95 backdrop-blur-xl sm:top-[4.5rem]">
      <div className="cb-shell flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((item) => <button key={item.id} type="button" onClick={() => chooseSection(item.id)} aria-current={activeSection === item.id ? "page" : undefined} className={`relative min-h-16 shrink-0 px-4 text-left sm:px-6 ${activeSection === item.id ? "text-white" : "text-slate-400 hover:text-slate-200"}`}><span className="block text-sm font-black">{item.label}</span><span className="mt-0.5 hidden text-xs font-bold sm:block">{item.detail}</span>{activeSection === item.id ? <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-amber-300 to-cyan-300" /> : null}</button>)}
      </div>
    </nav>

    <div id="club-admin-content" className="cb-shell scroll-mt-36 py-6 sm:scroll-mt-40 sm:py-9">
      {activeSection === "overview" ? <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SummaryCard value={props.pendingRequestsError ? null : props.pendingRequests.length} label="Pending requests" detail={props.pendingRequestsError ? "Temporarily unavailable" : "Players awaiting a decision"} tone="text-amber-300" /><SummaryCard value={upcomingCount} label="Upcoming plans" detail="Published calendar items" tone="text-cyan-300" /><SummaryCard value={openChallengeCount} label="Open challenges" detail="Member practice requests" tone="text-emerald-300" /><SummaryCard value={props.achievements.length} label="Club honours" detail={`${props.followerCount} club followers`} tone="text-violet-300" /></section>

        {props.pendingRequestsError ? <DataLoadNotice title="Membership requests could not be checked" detail="We will not show an incorrect zero. Try again to load the players waiting for approval." /> : props.pendingRequests.length ? <button type="button" onClick={() => chooseSection("people")} className="flex w-full items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-left sm:p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-xl font-black text-amber-200">{props.pendingRequests.length}</span><span className="min-w-0 flex-1"><span className="block font-black text-amber-100">Membership requests need attention</span><span className="mt-1 block text-sm text-amber-100/60">Review and welcome the players waiting to join.</span></span><span className="font-black text-amber-300">Review →</span></button> : <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] px-5 py-4 text-sm font-bold text-emerald-200">✓ No membership approvals are waiting.</div>}

        <section className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-5 sm:p-7"><div><p className="cb-kicker">Organizer launchpad</p><h2 className="mt-2 text-2xl font-black">What needs doing?</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><button type="button" onClick={() => chooseSection("people")} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left hover:border-amber-300/25"><span className="font-black">Approve members</span><span className="mt-1 block text-xs leading-5 text-slate-400">Requests, roles and club details</span></button><button type="button" onClick={() => chooseSection("content")} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left hover:border-cyan-300/25"><span className="font-black">Publish an update</span><span className="mt-1 block text-xs leading-5 text-slate-400">News, calendar and recognition</span></button><button type="button" onClick={() => chooseSection("operations")} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left hover:border-emerald-300/25"><span className="font-black">Run the venue</span><span className="mt-1 block text-xs leading-5 text-slate-400">Tables, guide and practice board</span></button><Link href="/tournaments/new" className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:border-violet-300/25"><span className="font-black">Create competition</span><span className="mt-1 block text-xs leading-5 text-slate-400">Tournament or league setup</span></Link></div></section>

        <section className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-white/10 bg-slate-900/55 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Published</p><p className="mt-2 text-2xl font-black">{props.announcements.length} updates</p><p className="mt-2 text-sm text-slate-400">Visible on the member page.</p></article><article className="rounded-2xl border border-white/10 bg-slate-900/55 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Community</p><p className="mt-2 text-2xl font-black">{props.members.length} members</p><p className="mt-2 text-sm text-slate-400">With {props.followerCount} followers.</p></article><article className="rounded-2xl border border-white/10 bg-slate-900/55 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Live control</p><p className="mt-2 text-2xl font-black">{props.liveEventCount} events</p><p className="mt-2 text-sm text-slate-400">Currently running competitions.</p></article></section>
      </div> : null}

      {activeSection === "people" ? <div className="space-y-6"><div><p className="cb-kicker">People & identity</p><h2 className="mt-2 text-3xl font-black">Membership and club settings</h2><p className="mt-2 text-sm text-slate-400">Approve requests, assign trusted admins and keep the public club details accurate.</p></div>{props.pendingRequestsError ? <DataLoadNotice title="Membership requests could not be loaded" detail="Your member data has not changed. Retry before deciding whether anyone is waiting." /> : null}<ClubCommunityPanel club={props.club} userId={props.userId} isFollowing={false} ownRole={props.role} ownRequest={null} pendingRequests={props.pendingRequests} members={props.members} defaultRequestName="" guide={props.guide} isAdmin managementOnly /><ClubModerationCenter clubId={props.club.id} userId={props.userId} role={props.role} members={props.members} initialReports={props.reports} initialRestrictions={props.restrictions} initialBlocks={props.blocks} /></div> : null}

      {activeSection === "content" ? <div className="space-y-6"><div><p className="cb-kicker">Publishing studio</p><h2 className="mt-2 text-3xl font-black">Messages, calendar, gallery & honours</h2><p className="mt-2 text-sm text-slate-400">Everything published here reaches the organized member experience.</p></div><ClubCommunicationCenter clubId={props.club.id} clubName={props.club.name} initialBroadcasts={props.broadcasts} /><ClubCalendarBoard clubId={props.club.id} clubSlug={props.club.slug} isAdmin isMember userId={props.userId} initialEvents={props.calendarEvents} initialRsvps={props.calendarRsvps} /><ClubAnnouncementBoard key={props.announcements.map((item) => item.updated_at).join("|")} clubId={props.club.id} initialAnnouncements={props.announcements} isAdmin /><ClubGallery clubId={props.club.id} clubName={props.club.name} isAdmin initialItems={props.galleryItems} /><ClubAchievementWall key={props.achievements.map((item) => item.updated_at).join("|")} clubId={props.club.id} clubSlug={props.club.slug} isAdmin members={props.members} initialAchievements={props.achievements} /></div> : null}

      {activeSection === "operations" ? <div className="space-y-6"><div><p className="cb-kicker">Club operations</p><h2 className="mt-2 text-3xl font-black">Venue and practice control</h2><p className="mt-2 text-sm text-slate-400">Keep house rules clear, practice active and the table floor moving.</p></div><ClubGuide clubId={props.club.id} isAdmin location={props.club.location} /><ClubPracticeBoard clubId={props.club.id} clubSlug={props.club.slug} userId={props.userId} isMember isAdmin memberNames={memberNames} initialChallenges={props.challenges} /><TableManager clubId={props.club.id} /></div> : null}
    </div>
  </div>;
}
