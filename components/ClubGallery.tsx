"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { RemoteMedia } from "@/components/RemoteMedia";
import type { ClubGalleryItemRow } from "@/lib/club-command-center";
import { createClubGalleryItem, deleteClubGalleryItem, subscribeToClubGallery } from "@/lib/cloud/club-gallery";
import { removePublicImage, uploadPublicImage, validateImageFile } from "@/lib/cloud/media";

interface Props {
  clubId: string;
  clubName: string;
  isAdmin: boolean;
  initialItems: ClubGalleryItemRow[];
}

function todayValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function galleryDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function ClubGallery({ clubId, clubName, isAdmin, initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [caption, setCaption] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayValue);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToClubGallery(clubId, () => router.refresh()), [clubId, router]);
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy("create");
    setMessage("");
    let uploaded: { path: string; url: string } | null = null;
    try {
      uploaded = await uploadPublicImage(`clubs/${clubId}/gallery`, file);
      const created = await createClubGalleryItem({ clubId, imageUrl: uploaded.url, caption, occurredOn });
      setItems((current) => [created, ...current]);
      setCaption("");
      setOccurredOn(todayValue());
      setFile(null);
      setPreview("");
      setMessage("Photo published to the club gallery.");
      router.refresh();
    } catch (error) {
      if (uploaded) void removePublicImage(uploaded.url).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "That photo could not be published.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: ClubGalleryItemRow) {
    if (busy || !window.confirm("Remove this photo from the club gallery?")) return;
    setBusy(`delete:${item.id}`);
    setMessage("");
    try {
      await deleteClubGalleryItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      void removePublicImage(item.image_url).catch(() => undefined);
      setMessage("Photo removed from the gallery.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That photo could not be removed.");
    } finally {
      setBusy("");
    }
  }

  return <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.11),transparent_24rem),rgba(15,23,42,.68)]">
    <div className="border-b border-white/10 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker">Club gallery</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Moments from {clubName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Tournament action, meetings, award ceremonies and the people behind the club.</p></div><span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-200">{items.length} photo{items.length === 1 ? "" : "s"}</span></div>
    </div>
    <div className="p-5 sm:p-7">
      {items.length ? <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">{items.map((item) => <article key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/50"><div className="relative aspect-[4/3] overflow-hidden"><RemoteMedia src={item.image_url} alt={item.caption || `${clubName} club gallery photo`} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" /></div><div className="p-4">{item.caption ? <p className="text-sm font-bold leading-6 text-slate-200">{item.caption}</p> : null}<div className="mt-2 flex items-center justify-between gap-3"><time className="text-xs font-black uppercase tracking-wider text-slate-400">{galleryDate(item.occurred_on)}</time>{isAdmin ? <button type="button" onClick={() => void remove(item)} disabled={Boolean(busy)} className="text-xs font-black text-rose-200">{busy === `delete:${item.id}` ? "Removing…" : "Remove"}</button> : null}</div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center"><p className="text-xl font-black text-white">The gallery is ready for its first moment.</p><p className="mt-2 text-sm text-slate-400">Club organizers can publish tournament, meeting and award photos here.</p></div>}

      {isAdmin ? <details className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 sm:p-5"><summary className="cursor-pointer font-black text-cyan-100">+ Add a gallery photo</summary><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-300 sm:col-span-2">Photo<span className="mt-2 flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950 p-3">{preview ? <span className="h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-white/10"><img src={preview} alt="Gallery preview" className="h-full w-full object-cover" /></span> : <span className="grid h-24 w-32 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-3xl">📸</span>}<span className="min-w-0 flex-1"><input type="file" required accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; const problem = next ? validateImageFile(next) : null; if (problem) { setMessage(problem); event.target.value = ""; return; } setFile(next); setPreview(next ? URL.createObjectURL(next) : ""); setMessage(""); }} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:font-black file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-400">JPG, PNG or WebP · maximum 5 MB</span></span></span></label><label className="text-sm font-bold text-slate-300 sm:col-span-2">Short caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={220} rows={3} placeholder="What happened in this moment?" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300/40" /></label><label className="text-sm font-bold text-slate-300">Date<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} max={todayValue()} required className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none" /></label><button type="submit" disabled={Boolean(busy) || !file} className="min-h-12 self-end rounded-xl bg-cyan-400 px-5 font-black text-slate-950 disabled:opacity-50">{busy === "create" ? "Publishing…" : "Publish photo"}</button></form></details> : null}
      {message ? <p role="status" className="mt-4 rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}
    </div>
  </section>;
}
