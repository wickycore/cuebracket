import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicLandingHeader } from "@/components/PublicLandingHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Play, compete and follow pool",
  description: "Discover live pool matches, local tournaments, clubs, players and pool gear on CueBracket.",
  alternates: { canonical: "/" },
};

type LiveTournament = { id: string; name: string; venue: string; race_to: number; players: string[] };
type UpcomingEvent = { tournament_id: string; event_name: string; venue: string; scheduled_at: string | null };
type Listing = { id: string; title: string; price: number; currency: string; location: string };

const discovery = [
  { title: "Live now", detail: "Watch matches as they happen", href: "/events", icon: "live", tone: "text-cyan-300" },
  { title: "Upcoming events", detail: "Find tournaments near you", href: "/events", icon: "calendar", tone: "text-sky-300" },
  { title: "Find a club", detail: "Discover your local pool scene", href: "/clubs", icon: "pin", tone: "text-emerald-300" },
  { title: "Marketplace", detail: "Buy and sell pool gear", href: "/marketplace", icon: "cart", tone: "text-amber-300" },
];

function Icon({ name }: { name: string }) {
  if (name === "home") return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="m3 11 9-8 9 8v9h-6v-6H9v6H3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>;
  if (name === "clubs") return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20m.5-6h.8a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "calendar") return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M8 3v5m8-5v5M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
  if (name === "pin") return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
  if (name === "cart") return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="M3 4h2l2 11h10l3-8H6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/></svg>;
  return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8m12.8-12.8a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

function formatPrice(listing: Listing) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: listing.currency || "KES", maximumFractionDigits: 0 }).format(listing.price);
}

function eventDate(value: string | null) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-KE", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [liveResult, eventResult, listingResult] = await Promise.all([
    supabase.from("cloud_tournaments").select("id,name,venue,race_to,players").eq("is_public", true).eq("status", "live").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("event_registration_settings").select("tournament_id,event_name,venue,scheduled_at").eq("registration_open", true).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("marketplace_listings").select("id,title,price,currency,location").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const live = liveResult.data as LiveTournament | null;
  const upcoming = eventResult.data as UpcomingEvent | null;
  const listing = listingResult.data as Listing | null;

  return (
    <div className="cb-app-bg min-h-dvh overflow-x-clip pb-20 text-white md:pb-0">
      <PublicLandingHeader signedIn={Boolean(user)} />
      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.18),transparent_28rem),radial-gradient(circle_at_90%_12%,rgba(59,130,246,.14),transparent_26rem),linear-gradient(180deg,#0a1a2d,#06101f)]">
          <Image src="/cuebracket-player-hero.png" alt="Pool player lining up a shot" fill priority sizes="100vw" className="pointer-events-none origin-right scale-[.92] object-cover object-[82%_center] opacity-70 sm:scale-100 sm:object-[76%_center] lg:opacity-75" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#06101f_0%,rgba(6,16,31,.97)_40%,rgba(6,16,31,.42)_68%,rgba(6,16,31,.1)_100%),linear-gradient(0deg,#06101f_0%,transparent_48%)]" />
          <div className="cb-shell relative grid gap-7 py-9 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,.95fr)] lg:items-center lg:gap-14 lg:py-16">
            <div>
              <p className="cb-kicker">The home of every pool player</p>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.7rem,7vw,5.25rem)] font-black leading-[.96] tracking-[-.055em]">Play. Compete.<br/><span className="text-cyan-300">Follow the game.</span></h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Discover live matches, local tournaments, clubs, players and pool gear—all in one place.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/events" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">▶ Explore live matches</Link>
                <Link href={user ? "/dashboard" : "/auth/signup"} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#2a4a6f] px-5 py-3 text-sm font-black text-slate-100 hover:bg-white/5">{user ? "Open my home" : "Create free account"} →</Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-slate-400"><span>● Players and fans</span><span>◆ Clubs and organizers</span><span>◇ Local marketplace</span></div>
            </div>

            <div className="cb-card relative min-h-64 overflow-hidden rounded-[2rem] p-5 sm:p-6">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-45" style={{backgroundImage:"linear-gradient(90deg,transparent 49.5%,rgba(77,216,196,.25) 50%,transparent 50.5%),linear-gradient(rgba(77,216,196,.12) 1px,transparent 1px)",backgroundSize:"100% 100%,100% 28px"}} />
              <div className="relative flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300"/> {live ? "Live now" : "CueBracket Live"}</span><span className="text-xs text-slate-400">Public spectator view</span></div>
              <h2 className="relative mt-6 text-2xl font-black">{live?.name || "Follow every shot live"}</h2>
              <p className="relative mt-2 text-sm text-slate-400">{live ? `${live.venue || "Venue TBA"} · Race to ${live.race_to}` : "Live brackets, scores and match progress—right from your phone."}</p>
              {live?.players?.length ? <div className="relative mt-5 flex items-center gap-3 text-sm font-black"><span className="rounded-xl bg-white/5 px-3 py-2">{live.players[0]}</span><span className="text-slate-500">vs</span><span className="rounded-xl bg-white/5 px-3 py-2">{live.players[1] || "Next opponent"}</span></div> : null}
              <Link href={live ? `/cloud/live/${live.id}` : "/events"} className="relative mt-7 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-300/50 text-sm font-black text-cyan-100 hover:bg-cyan-300/10">{live ? "Watch bracket" : "See live matches"} →</Link>
            </div>
          </div>
        </section>

        <section className="cb-shell py-7 sm:py-9">
          <Link href="/events" className="cb-card cb-card-hover mx-auto flex min-h-14 max-w-3xl items-center gap-3 rounded-2xl px-4 text-slate-400 hover:text-white sm:px-5"><svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="2"/></svg><span className="truncate">Search players, tournaments, clubs or gear</span><span className="ml-auto text-cyan-300">→</span></Link>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {discovery.map((item) => <Link key={item.title} href={item.href} className="cb-card cb-card-hover group flex min-h-24 items-center gap-3 rounded-2xl p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.035] ${item.tone}`}><Icon name={item.icon}/></span><span className="min-w-0"><span className="block text-sm font-black sm:text-base">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{item.detail}</span></span><span className="ml-auto text-slate-500 group-hover:text-cyan-300">›</span></Link>)}
          </div>

          <div className="mt-9 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Discover CueBracket</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Happening now</h2></div><Link href="/events" className="text-sm font-black text-cyan-300">View more →</Link></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link href={live ? `/cloud/live/${live.id}` : "/events"} className="cb-card cb-card-hover rounded-2xl p-5"><span className="rounded-lg bg-rose-400/10 px-2.5 py-1 text-xs font-black uppercase text-rose-300">● Live</span><h3 className="mt-4 text-lg font-black">{live?.name || "Public live brackets"}</h3><p className="mt-2 text-sm text-slate-400">{live ? live.venue || "Venue TBA" : "Watch tournament scores update in real time."}</p><span className="mt-5 block text-sm font-black text-cyan-300">Watch now →</span></Link>
            <Link href={upcoming ? `/register/${upcoming.tournament_id}` : "/events"} className="cb-card cb-card-hover rounded-2xl p-5"><span className="rounded-lg bg-sky-400/10 px-2.5 py-1 text-xs font-black uppercase text-sky-300">Upcoming</span><h3 className="mt-4 text-lg font-black">{upcoming?.event_name || "Find your next tournament"}</h3><p className="mt-2 text-sm text-slate-400">{upcoming ? `${eventDate(upcoming.scheduled_at)} · ${upcoming.venue || "Venue TBA"}` : "Browse open registrations near you."}</p><span className="mt-5 block text-sm font-black text-cyan-300">Explore events →</span></Link>
            <Link href={listing ? `/marketplace/${listing.id}` : "/marketplace"} className="cb-card cb-card-hover rounded-2xl p-5"><span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-black uppercase text-emerald-300">Marketplace</span><h3 className="mt-4 text-lg font-black">{listing?.title || "Pool gear from the community"}</h3><p className="mt-2 text-sm text-slate-400">{listing ? `${formatPrice(listing)} · ${listing.location}` : "Buy and sell cues, cases, tables and accessories."}</p><span className="mt-5 block text-sm font-black text-cyan-300">Browse gear →</span></Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-950/45 py-9"><div className="cb-shell grid gap-5 text-center sm:grid-cols-3"><div><p className="font-black">For every pool player</p><p className="mt-1 text-sm text-slate-400">Play, follow and build your record.</p></div><div><p className="font-black">For clubs and organizers</p><p className="mt-1 text-sm text-slate-400">Run events without crowding the public experience.</p></div><div><p className="font-black">For the whole community</p><p className="mt-1 text-sm text-slate-400">Discover people, places and gear.</p></div></div></section>
      </main>

      <nav aria-label="Mobile public navigation" className="cb-safe-bottom fixed inset-x-0 bottom-0 z-[110] grid grid-cols-4 border-t border-white/10 bg-[#020617]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        {[["Home","/","home"],["Live","/events","live"],["Clubs","/clubs","clubs"],["Market","/marketplace","cart"]].map(([label,href,icon])=><Link key={label} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl text-sm font-black ${href === "/" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-300"}`}><span className="[&>svg]:h-7 [&>svg]:w-7"><Icon name={icon}/></span><span>{label}</span></Link>)}
      </nav>
    </div>
  );
}
