import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ClubCommunityPanel, type ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubMembershipRequestRow, ClubMemberRow, ClubRow } from "@/lib/clubs";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
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
  const [{ data: memberRows }, { data: followerRows }, { data: eventsData }] = await Promise.all([
    supabase.from("club_members").select("*").eq("club_id", club.id).order("created_at"),
    supabase.from("club_followers").select("club_id, user_id").eq("club_id", club.id),
    supabase.from("event_registration_settings").select("*").eq("club_id", club.id).eq("registration_open", true).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(12),
  ]);
  const memberships = (memberRows ?? []) as ClubMemberRow[];
  const followerIds = (followerRows ?? []).map((item) => item.user_id);
  const ownMembership = user ? memberships.find((item) => item.user_id === user.id) ?? null : null;
  const isAdmin = Boolean(user && (club.owner_id === user.id || ownMembership?.role === "owner" || ownMembership?.role === "admin"));

  const memberIds = memberships.map((item) => item.user_id);
  const [{ data: profileRows }, ownRequestResult, pendingResult] = await Promise.all([
    memberIds.length
      ? supabase.from("profiles").select("id, display_name, username, tournament_name").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("user_id", user.id).eq("status", "pending").maybeSingle()
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase.from("club_membership_requests").select("*").eq("club_id", club.id).eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] }),
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
