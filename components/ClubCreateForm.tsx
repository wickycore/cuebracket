"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClub, updateClub } from "@/lib/cloud/clubs";
import { removePublicImage, uploadPublicImage, validateImageFile } from "@/lib/cloud/media";
import { normalizeClubSlug } from "@/lib/clubs";

export function ClubCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(normalizeClubSlug(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      let club = await createClub({ name, slug, location, description });
      if (logoFile) {
        let uploaded: { url: string } | null = null;
        try {
          uploaded = await uploadPublicImage(`clubs/${club.id}/logo`, logoFile);
          club = await updateClub(club.id, { name, slug, location, description, logoUrl: uploaded.url });
        } catch {
          if (uploaded) void removePublicImage(uploaded.url).catch(() => undefined);
          // The optional logo must never block creation; organizers can retry from Manage club.
        }
      }
      router.push(`/clubs/${club.slug}`);
      router.refresh();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      setMessage(code === "23505" ? "That club link is already taken. Choose another one." : error instanceof Error ? error.message : "Unable to create the club.");
      setBusy(false);
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/55 focus:ring-4 focus:ring-cyan-400/10";

  return (
    <form onSubmit={submit} className="mt-8 space-y-6 rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-300 sm:col-span-2">
          Club name
          <input value={name} onChange={(event) => changeName(event.target.value)} required maxLength={80} placeholder="e.g. Kasarani Pool Club" className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-300">
          Public club link
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-slate-600">/clubs/</span>
            <input value={slug} onChange={(event) => { setSlugEdited(true); setSlug(normalizeClubSlug(event.target.value)); }} required minLength={3} maxLength={48} className={`${inputClass} pl-[4.5rem]`} />
          </div>
        </label>
        <label className="text-sm font-bold text-slate-300">
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} placeholder="e.g. Kasarani, Nairobi" className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-300 sm:col-span-2">
          Short description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="Tell players what makes this club special." className={`${inputClass} resize-none`} />
          <span className="mt-2 block text-right text-xs text-slate-600">{description.length}/500</span>
        </label>
        <label className="text-sm font-bold text-slate-300 sm:col-span-2">
          Club logo or image <span className="font-normal text-slate-600">(optional)</span>
          <span className="mt-2 flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            {logoPreview ? <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10"><img src={logoPreview} alt="Club logo preview" className="h-full w-full object-cover" /></span> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-3xl font-black text-cyan-200">{name.charAt(0).toUpperCase() || "C"}</span>}
            <span className="min-w-0 flex-1"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; const problem = file ? validateImageFile(file) : null; if (problem) { setMessage(problem); event.target.value = ""; return; } setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : ""); setMessage(""); }} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2.5 file:font-black file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-600">JPG, PNG or WebP · maximum 5 MB</span></span>
          </span>
        </label>
      </div>
      {message ? <p role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-100">{message}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.back()} className="rounded-2xl border border-white/10 px-5 py-3 font-bold text-slate-300">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{busy ? "Creating…" : "Create club →"}</button>
      </div>
    </form>
  );
}
