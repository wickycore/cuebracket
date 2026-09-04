"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import { RemoteMedia } from "@/components/RemoteMedia";
import {
  clubAchievementIcon,
  clubAchievementLabel,
  type ClubAchievementKind,
  type ClubAchievementRow,
} from "@/lib/club-command-center";
import {
  createClubAchievement,
  deleteClubAchievement,
  setClubAchievementFeatured,
  subscribeToClubAchievements,
} from "@/lib/cloud/club-achievements";
import { removePublicImage, uploadPublicImage, validateImageFile } from "@/lib/cloud/media";

type WallFilter = "all" | "featured" | "competitive" | "community";

interface Props {
  clubId: string;
  clubSlug: string;
  isAdmin: boolean;
  members: ClubMemberView[];
  initialAchievements: ClubAchievementRow[];
}

const kinds: ClubAchievementKind[] = ["champion", "podium", "milestone", "sportsmanship", "contribution", "custom"];
const filters: Array<{ id: WallFilter; label: string }> = [
  { id: "all", label: "All honours" },
  { id: "featured", label: "Featured" },
  { id: "competitive", label: "Competition" },
  { id: "community", label: "Community" },
];

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function achievementDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(date)
    : value;
}

export function ClubAchievementWall({ clubId, clubSlug, isAdmin, members, initialAchievements }: Props) {
  const router = useRouter();
  const [achievements, setAchievements] = useState(initialAchievements);
  const [filter, setFilter] = useState<WallFilter>("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [recipientId, setRecipientId] = useState(members[0]?.userId ?? "");
  const [kind, setKind] = useState<ClubAchievementKind>("champion");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [awardedOn, setAwardedOn] = useState(todayValue);
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => subscribeToClubAchievements(clubId, () => router.refresh()), [clubId, router]);
  useEffect(() => () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);
  const visible = achievements.filter((item) => {
    if (filter === "featured") return item.is_featured;
    if (filter === "competitive") return item.kind === "champion" || item.kind === "podium" || item.kind === "milestone";
    if (filter === "community") return item.kind === "sportsmanship" || item.kind === "contribution" || item.kind === "custom";
    return true;
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("create");
    setMessage("");
    let uploaded: { path: string; url: string } | null = null;
    try {
      if (imageFile) uploaded = await uploadPublicImage(`clubs/${clubId}/achievements`, imageFile);
      const created = await createClubAchievement({ clubId, recipientId, kind, title, description, awardedOn, isFeatured, imageUrl: uploaded?.url ?? null });
      setAchievements((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setIsFeatured(false);
      setImageFile(null);
      setImagePreview("");
      setFilter("all");
      setMessage("Recognition added to the wall.");
      router.refresh();
    } catch (error) {
      if (uploaded) void removePublicImage(uploaded.url).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "That recognition could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function toggleFeatured(item: ClubAchievementRow) {
    if (busy) return;
    setBusy(`feature:${item.id}`);
    setMessage("");
    try {
      const updated = await setClubAchievementFeatured(item.id, !item.is_featured);
      setAchievements((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That spotlight could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: ClubAchievementRow) {
    if (busy || !window.confirm(`Remove “${item.title}” from the club wall?`)) return;
    setBusy(`delete:${item.id}`);
    setMessage("");
    try {
      await deleteClubAchievement(item.id);
      setAchievements((current) => current.filter((entry) => entry.id !== item.id));
      if (item.image_url) void removePublicImage(item.image_url).catch(() => undefined);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That recognition could not be removed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.12),transparent_24rem),rgba(15,23,42,.68)]">
      <div className="border-b border-white/10 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Club honours</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Achievement wall</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Celebrate competitive results, milestones, sportsmanship and the people who make the club better.</p>
          </div>
          <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">{achievements.length} recognition{achievements.length === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-black ${filter === item.id ? "bg-amber-300 text-slate-950" : "border border-white/10 bg-slate-950/40 text-slate-400"}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {visible.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => {
              const member = memberById.get(item.recipient_id);
              const card = <>{item.image_url ? <div className="-mx-5 -mt-5 mb-5 h-40 overflow-hidden border-b border-white/10"><RemoteMedia src={item.image_url} alt={`${item.title} achievement`} sizes="(max-width: 768px) 100vw, 33vw" /></div> : null}<div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl">{clubAchievementIcon(item.kind)}</span>{item.is_featured ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-200">Featured</span> : null}</div><p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-amber-300">{clubAchievementLabel(item.kind)}</p><h3 className="mt-1 text-xl font-black text-white">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{item.description}</p><div className="mt-5 flex items-end justify-between gap-3 border-t border-white/8 pt-4"><span className="min-w-0"><span className="block truncate text-sm font-black text-white">{member?.name ?? item.recipient_name}</span><span className="mt-0.5 block text-xs font-bold text-slate-400">{achievementDate(item.awarded_on)}</span></span><span className="shrink-0 text-xs font-black text-amber-300">Read story →</span></div></>;
              return <article key={item.id} className={`rounded-[1.6rem] border p-5 ${item.is_featured ? "border-amber-300/25 bg-[linear-gradient(145deg,rgba(120,53,15,.24),rgba(2,6,23,.68))]" : "border-white/10 bg-slate-950/40"}`}><Link href={`/clubs/${clubSlug}/achievements/${item.id}`} className="block">{card}</Link>{item.source === "system" ? <p className="mt-4 border-t border-white/8 pt-3 text-xs font-black uppercase tracking-wider text-emerald-300">✓ Automatically verified by CueBracket</p> : null}{isAdmin ? <div className="mt-4 flex gap-2 border-t border-white/8 pt-4"><button type="button" onClick={() => void toggleFeatured(item)} disabled={Boolean(busy)} className="min-h-10 flex-1 rounded-xl border border-amber-300/20 px-3 text-xs font-black text-amber-200">{busy === `feature:${item.id}` ? "Saving…" : item.is_featured ? "Remove spotlight" : "Feature on Home"}</button><button type="button" onClick={() => void remove(item)} disabled={Boolean(busy)} className="min-h-10 rounded-xl border border-rose-300/20 px-3 text-xs font-black text-rose-200">{busy === `delete:${item.id}` ? "Removing…" : "Remove"}</button></div> : null}</article>;
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
            <p className="font-black text-white">{achievements.length ? "No honours match this filter." : "The honours wall is ready for its first story."}</p>
            <p className="mt-2 text-sm text-slate-400">{isAdmin ? "Recognise a club member below." : `Club organisers can add achievements here. Browse more from /clubs/${clubSlug}.`}</p>
          </div>
        )}

        {isAdmin ? (
          <details className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4 sm:p-5">
            <summary className="cursor-pointer font-black text-amber-100">+ Recognise a member</summary>
            <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] px-4 py-3 text-xs font-bold leading-5 text-emerald-100 sm:col-span-2">Attendance milestones at 5, 10, 25, 50 and 100 events—and each monthly Club MVP—are awarded automatically. Use this form only for personal honours such as sportsmanship, contribution or a custom club story.</div>
              <label className="text-sm font-bold text-slate-300">Club member<select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none"><option value="" disabled>Choose a member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
              <label className="text-sm font-bold text-slate-300">Recognition type<select value={kind} onChange={(event) => setKind(event.target.value as ClubAchievementKind)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none">{kinds.map((item) => <option key={item} value={item}>{clubAchievementIcon(item)} {clubAchievementLabel(item)}</option>)}</select></label>
              <label className="text-sm font-bold text-slate-300 sm:col-span-2">Achievement title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={80} required placeholder="e.g. Nairobi Open Champion" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-white outline-none focus:border-amber-300/40" /></label>
              <label className="text-sm font-bold text-slate-300 sm:col-span-2">Why they are being recognised<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} required rows={3} placeholder="Add the result, milestone or contribution." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-300/40" /></label>
              <label className="text-sm font-bold text-slate-300 sm:col-span-2">Achievement photo <span className="font-normal text-slate-400">(optional)</span><span className="mt-2 flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950 p-3">{imagePreview ? <span className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10"><img src={imagePreview} alt="Achievement preview" className="h-full w-full object-cover" /></span> : <span className="grid h-20 w-28 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/10 text-3xl">🏆</span>}<span className="min-w-0 flex-1"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; const problem = file ? validateImageFile(file) : null; if (problem) { setMessage(problem); event.target.value = ""; return; } setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : ""); setMessage(""); }} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-black file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-400">Trophy, team photo or event moment · maximum 5 MB</span></span></span></label>
              <label className="text-sm font-bold text-slate-300">Achievement date<input type="date" value={awardedOn} onChange={(event) => setAwardedOn(event.target.value)} max={todayValue()} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none" /></label>
              <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-white/10 bg-slate-950/65 px-4 text-sm font-bold text-slate-300"><input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} className="h-4 w-4 accent-amber-300" />Feature on the club Home page</label>
              <button type="submit" disabled={Boolean(busy) || !members.length} className="min-h-12 rounded-xl bg-amber-300 px-5 font-black text-slate-950 disabled:opacity-50 sm:col-span-2">{busy === "create" ? "Adding recognition…" : "Add to achievement wall"}</button>
            </form>
          </details>
        ) : null}

        {message ? <p role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${message.includes("added") ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-rose-300/20 bg-rose-300/10 text-rose-100"}`}>{message}</p> : null}
      </div>
    </section>
  );
}
