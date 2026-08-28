import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubCommunityPanel, type ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubMembershipRequestRow, ClubMemberRow, ClubRow } from "@/lib/clubs";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import type { ClubPlayerRankingRow } from "@/lib/rankings";
import type { League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

interface Props { params: Promise<{ slug: string }> }

async function getClub(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  return data as ClubRow | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  return club ? { title: `${club.name} · CueBracket`, description: club.description || `Follow ${club.name} and register for its pool tournaments.` } : { title: "Club not found" };
}

export default async function ClubPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: clubData } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  const club = clubData as ClubRow | null;
  if (!club) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: memberRows }, { data: followerRows }, { data: eventsData }, { data: leagueData }] = await Promise.all([
    supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at"),
    supabase.from("club_followers").select("club_id, user_id").eq("club_id", club.id),
    supabase.from("event_registration_settings").select("*").eq("club_id", club.id).eq("registration_open", true).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(12),
    supabase.from("cloud_leagues").select("id, name, season, payload, updated_at").eq("club_id", club.id).eq("is_public", true).order("updated_at", { ascending: false }).limit(12),
  ]);
  const memberships = (memberRows ?? []) as ClubMemberRow[];
  const followerIds = (followerRows ?? []).map((item) => item.user_id);
  const ownMembership = user ? memberships.find((item) => item.user_id === user.id) ?? null : null;
  const isAdmin = Boolean(user && (club.owner_id === user.id || ownMembership?.role === "owner" || ownMembership?.role === "admin"));

  const memberIds = memberships.map((item) => item.user_id);
  const [{ data: profileRows }, ownRequestResult, pendingResult, { data: clubRankingData }] = await Promise.all([
    memberIds.length
      ? supabase.from("profiles").select("id, display_name, username, tournament_name").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("user_id", user.id).eq("status", "pending").maybeSingle()
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("club_player_rankings").select("*").eq("club_id", club.id).order("club_rank").limit(10),
  ]);
  const profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
  const members: ClubMemberView[] = memberships.map((membership) => {
    const profile = profileMap.get(membership.user_id);
    return {
      userId: membership.user_id,
      role: membership.role,
      name: profile?.tournament_name || profile?.display_name || "Club member",
      username: profile?.username ?? null,
    };
  });
  const ownProfile = user ? profileMap.get(user.id) : null;
  const events = (eventsData ?? []) as RegistrationSettingsRow[];
  const clubLeagues = (leagueData ?? []) as Array<{ id: string; name: string; season: string; payload: League }>;
  const clubRankings = (clubRankingData ?? []) as ClubPlayerRankingRow[];
  const initial = club.name.charAt(0).toUpperCase();

  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-11">
        <section className="overflow-hidden rounded-[2.2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_86%_10%,rgba(34,211,238,0.17),transparent_25rem),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
          <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" />
          <div className="p-7 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[1.75rem] border border-cyan-300/25 bg-cyan-400/10 text-4xl font-black text-cyan-200">{initial}</div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">CueBracket club</p>
                <h1 className="mt-2 break-words text-4xl font-black tracking-tight sm:text-6xl">{club.name}</h1>
                {club.location ? <p className="mt-3 font-bold text-slate-400">📍 {club.location}</p> : null}
              </div>
            </div>
            {club.description ? <p className="mt-7 max-w-3xl text-base leading-7 text-slate-300">{club.description}</p> : null}
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-black">
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2">{memberships.length} members</span>
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2">{followerIds.length} followers</span>
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2">{events.length} open events</span>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Upcoming</p><h2 className="mt-2 text-2xl font-black">Open registrations</h2></div>
                <span className="text-sm font-bold text-slate-500">{events.length}</span>
              </div>
              {events.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {events.map((event) => (
                    <Link key={event.tournament_id} href={`/register/${event.tournament_id}`} className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-cyan-400/30">
                      <p className="text-lg font-black">{event.event_name}</p>
                      <div className="mt-3 space-y-1 text-sm font-bold text-slate-500">
                        {event.scheduled_at ? <p>{new Date(event.scheduled_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p> : <p>Date to be announced</p>}
                        <p>{event.capacity} places · Race to {event.race_to}</p>
                      </div>
                      <p className="mt-4 text-sm font-black text-cyan-300">Register →</p>
                    </Link>
                  ))}
                </div>
              ) : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">No registration is open right now. Follow the club so future events are easy to find.</div>}
            </section>

            {clubLeagues.length ? (
              <section className="rounded-[1.75rem] border border-violet-400/15 bg-slate-900/60 p-5 sm:p-7">
                <div className="flex items-end justify-between gap-4">
                  <div><p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Club leagues</p><h2 className="mt-2 text-2xl font-black">Seasons & playoffs</h2></div>
                  {isAdmin ? <Link href="/leagues/new" className="text-sm font-black text-violet-300">Create season →</Link> : null}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {clubLeagues.map((item) => (
                    <Link key={item.id} href={`/league/${item.id}`} className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 transition hover:border-violet-300/30">
                      <div className="flex items-center justify-between gap-3"><p className="font-black text-white">{item.name}</p><span className="rounded-full bg-violet-300/10 px-2.5 py-1 text-xs font-black text-violet-200">{item.season}</span></div>
                      <p className="mt-3 text-sm font-bold capitalize text-slate-500">{item.payload?.status ?? "draft"}{item.payload?.playoff?.enabled ? ` · Top ${item.payload.playoff.qualifierCount} playoffs` : ""}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Club rankings</p><h2 className="mt-2 text-2xl font-black">Top players</h2></div>
                <Link href="/rankings" className="text-sm font-black text-cyan-300">Overall →</Link>
              </div>
              {clubRankings.length ? (
                <div className="mt-5 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                  {clubRankings.map((player) => (
                    <Link key={player.profile_id} href={`/players/${player.username}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04]">
                      <span className="font-black text-slate-500">#{player.club_rank}</span>
                      <span className="min-w-0"><span className="block truncate font-black text-white">{player.tournament_name || player.display_name}</span><span className="mt-0.5 block text-xs font-bold text-slate-600">{player.wins}–{player.losses} · {player.win_percentage}%</span></span>
                      <span className="font-black text-cyan-300">{player.ranking_points} pts</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Club members will rank here after their verified tournament results arrive.</p>}
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Club roster</p>
              <h2 className="mt-2 text-2xl font-black">Members</h2>
              {members.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {members.map((member) => {
                    const content = <><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] font-black text-cyan-200">{member.name.charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-black">{member.name}</span><span className="mt-0.5 block text-xs font-bold uppercase tracking-wider text-slate-600">{member.role}</span></span></>;
                    return member.username ? <Link key={member.userId} href={`/players/${member.username}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3 hover:border-cyan-400/25">{content}</Link> : <div key={member.userId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">{content}</div>;
                  })}
                </div>
              ) : <p className="mt-4 text-sm text-slate-500">The member roster is being built.</p>}
            </section>
          </div>

          <ClubCommunityPanel
            club={club}
            userId={user?.id ?? null}
            isFollowing={Boolean(user && followerIds.includes(user.id))}
            ownRole={ownMembership?.role ?? null}
            ownRequest={ownRequestResult.data as ClubMembershipRequestRow | null}
            pendingRequests={(pendingResult.data ?? []) as ClubMembershipRequestRow[]}
            members={members}
            defaultRequestName={ownProfile?.tournament_name || ownProfile?.display_name || ""}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </main>
  );
}
