import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { RemoteMedia } from "@/components/RemoteMedia";
import { clubAchievementIcon, clubAchievementLabel, type ClubAchievementRow } from "@/lib/club-command-center";
import type { ClubRow } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";

interface Props { params: Promise<{ slug: string; achievementId: string }> }

async function loadStory(slug: string, achievementId: string) {
  const supabase = await createClient();
  const { data: clubData } = await supabase.from("clubs").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  const club = clubData as ClubRow | null;
  if (!club) return null;
  const { data: achievementData } = await supabase.from("club_achievements").select("*").eq("club_id", club.id).eq("id", achievementId).maybeSingle();
  const achievement = achievementData as ClubAchievementRow | null;
  if (!achievement) return null;
  const { data: profile } = await supabase.from("profiles").select("username,is_public").eq("id", achievement.recipient_id).maybeSingle();
  return { club, achievement, profile };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, achievementId } = await params;
  const story = await loadStory(slug, achievementId);
  if (!story) return { title: "Achievement not found" };
  return {
    title: `${story.achievement.title} · ${story.club.name}`,
    description: `${story.achievement.recipient_name}: ${story.achievement.description}`,
    alternates: { canonical: `/clubs/${story.club.slug}/achievements/${story.achievement.id}` },
    openGraph: story.achievement.image_url ? { images: [{ url: story.achievement.image_url }] } : undefined,
  };
}

export default async function AchievementStoryPage({ params }: Props) {
  const { slug, achievementId } = await params;
  const story = await loadStory(slug, achievementId);
  if (!story) notFound();
  const { club, achievement, profile } = story;
  const awardedOn = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${achievement.awarded_on.slice(0, 10)}T12:00:00Z`));

  return <main className="min-h-dvh bg-[#020617] text-white">
    <AppHeader />
    <article className="cb-shell py-8 sm:py-12">
      <Link href={`/clubs/${club.slug}?tab=rankings`} className="text-sm font-black text-cyan-300">← Back to {club.name} honours</Link>
      <div className="mt-6 overflow-hidden rounded-[2.25rem] border border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.16),transparent_28rem),linear-gradient(145deg,rgba(30,20,9,.76),rgba(3,9,21,.96))]">
        {achievement.image_url ? <div className="relative aspect-[16/8] min-h-64 overflow-hidden border-b border-white/10"><RemoteMedia src={achievement.image_url} alt={`${achievement.title} achievement`} sizes="100vw" /></div> : null}
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-3xl">{clubAchievementIcon(achievement.kind)}</span><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-200">{clubAchievementLabel(achievement.kind)}</span>{achievement.is_featured ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Featured story</span> : null}</div>
          <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">{achievement.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">{achievement.description}</p>
          <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Recognised player</p><p className="mt-2 font-black text-white">{achievement.recipient_name}</p>{profile?.is_public && profile.username ? <Link href={`/players/${profile.username}`} className="mt-1 inline-block text-xs font-black text-cyan-300">View player profile →</Link> : null}</div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Achievement date</p><p className="mt-2 font-black text-white">{awardedOn}</p></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Presented by</p><Link href={`/clubs/${club.slug}`} className="mt-2 inline-block font-black text-amber-200">{club.name} →</Link></div></div>
        </div>
      </div>
    </article>
  </main>;
}
