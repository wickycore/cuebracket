import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

import { AppHeader } from "@/components/AppHeader";
import type { ClubRow } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Pool clubs · CueBracket",
  description: "Discover pool clubs, follow their events and join their CueBracket community.",
};

export default async function ClubsPage() {
  const supabase = await createClient();
  const { data: clubsData } = await supabase
    .from("clubs")
    .select("*")
    .eq("is_public", true)
    .order("name");
  const clubs = (clubsData ?? []) as ClubRow[];
  const clubIds = clubs.map((club) => club.id);

  const [{ data: members }, { data: followers }] = clubIds.length
    ? await Promise.all([
        supabase.from("club_members").select("club_id").in("club_id", clubIds),
        supabase.from("club_followers").select("club_id").in("club_id", clubIds),
      ])
    : [{ data: [] }, { data: [] }];

  const memberCounts = new Map<string, number>();
  const followerCounts = new Map<string, number>();
  for (const item of members ?? []) memberCounts.set(item.club_id, (memberCounts.get(item.club_id) ?? 0) + 1);
  for (const item of followers ?? []) followerCounts.set(item.club_id, (followerCounts.get(item.club_id) ?? 0) + 1);

  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <section className="overflow-hidden rounded-[2.2rem] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_32rem),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-7 sm:p-10">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">CueBracket clubs</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Your local pool scene, in one place.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                Follow clubs for upcoming tournaments, request membership and register for open events without chasing posters or group messages.
              </p>
            </div>
            <Link href="/clubs/new" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 hover:bg-cyan-300">
              + Create your club
            </Link>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Public directory</p>
              <h2 className="mt-2 text-2xl font-black">Clubs on CueBracket</h2>
            </div>
            <p className="text-sm font-bold text-slate-500">{clubs.length} club{clubs.length === 1 ? "" : "s"}</p>
          </div>

          {clubs.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club) => (
                <Link key={club.id} href={`/clubs/${club.slug}`} className="group rounded-[1.75rem] border border-white/10 bg-slate-900/65 p-6 transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-slate-900">
                  <div className="flex items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-2xl font-black text-cyan-200">
                      {club.logo_url ? <img src={club.logo_url} alt="" className="h-full w-full object-cover" /> : club.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black group-hover:text-cyan-200">{club.name}</h3>
                      <p className="mt-1 truncate text-sm font-bold text-slate-500">{club.location || "Online club"}</p>
                    </div>
                  </div>
                  <p className="mt-5 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-400">
                    {club.description || "Follow this club to discover its next CueBracket tournament."}
                  </p>
                  <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    <span>{memberCounts.get(club.id) ?? 0} members</span>
                    <span>{followerCounts.get(club.id) ?? 0} followers</span>
                    <span className="ml-auto text-cyan-300">View club →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
              <p className="text-xl font-black">The club directory is ready.</p>
              <p className="mt-2 text-sm text-slate-500">Create the first club and invite your pool community.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
