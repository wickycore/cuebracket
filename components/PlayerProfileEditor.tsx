"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { normalizeUsername, validatePlayerProfile } from "@/lib/playerProfile";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage, uploadPublicImage, validateImageFile } from "@/lib/cloud/media";

interface PlayerProfileEditorProps {
  userId: string;
  initialProfile: {
    displayName: string;
    username: string;
    tournamentName: string;
    bio: string;
    isPublic: boolean;
    avatarUrl: string | null;
  };
}

export function PlayerProfileEditor({ userId, initialProfile }: PlayerProfileEditorProps) {
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [username, setUsername] = useState(initialProfile.username);
  const [tournamentName, setTournamentName] = useState(initialProfile.tournamentName);
  const [bio, setBio] = useState(initialProfile.bio);
  const [isPublic, setIsPublic] = useState(initialProfile.isPublic);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(initialProfile.avatarUrl ?? "");
  const [savedUsername, setSavedUsername] = useState(initialProfile.username);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => () => {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const validation = validatePlayerProfile({ displayName, username, tournamentName, bio });
    if (!validation.ok) {
      setSuccess(false);
      setMessage(validation.message);
      return;
    }

    setBusy(true);
    setMessage("");
    setSuccess(false);

    const clean = validation.value;
    let uploaded: { path: string; url: string } | null = null;
    try {
      if (avatarFile) uploaded = await uploadPublicImage(`profiles/${userId}/avatar`, avatarFile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The profile photo could not be uploaded.");
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: clean.displayName,
        username: clean.username,
        tournament_name: clean.tournamentName,
        bio: clean.bio,
        avatar_url: (uploaded?.url ?? avatarUrl) || null,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      if (uploaded) void removePublicImage(uploaded.url).catch(() => undefined);
      setSuccess(false);
      setMessage(
        error.code === "23505"
          ? `@${clean.username} is already taken. Try another username.`
          : error.message,
      );
      setBusy(false);
      return;
    }

    await supabase.auth.updateUser({ data: { display_name: clean.displayName } });

    if (uploaded) {
      const previousAvatar = avatarUrl;
      setAvatarUrl(uploaded.url);
      setAvatarFile(null);
      setAvatarPreview(uploaded.url);
      if (previousAvatar && previousAvatar !== uploaded.url) void removePublicImage(previousAvatar).catch(() => undefined);
    }

    setDisplayName(clean.displayName);
    setUsername(clean.username);
    setTournamentName(clean.tournamentName);
    setBio(clean.bio);
    setSavedUsername(clean.username);
    setSuccess(true);
    setMessage("Player profile saved.");
    setBusy(false);
  }

  const inputClass =
    "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

  return (
    <section className="mt-8 rounded-[1.75rem] border border-cyan-400/15 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Player profile beta
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">Your pool identity</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Use one permanent CueBracket username and choose the name you prefer inside tournament draws.
          </p>
        </div>

        {savedUsername && isPublic ? (
          <a
            href={`/players/${savedUsername}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-4 text-sm font-black text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/10"
          >
            View public profile
          </a>
        ) : null}
      </div>

      <form onSubmit={saveProfile} className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-300 sm:col-span-2">
          Profile picture <span className="font-normal text-slate-400">(optional)</span>
          <span className="mt-2 flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            {avatarPreview ? <span className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.4rem] border border-white/10"><img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" /></span> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[1.4rem] border border-cyan-300/20 bg-cyan-400/10 text-3xl font-black text-cyan-200">{displayName.trim().charAt(0).toUpperCase() || "C"}</span>}
            <span className="min-w-0 flex-1"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; const problem = file ? validateImageFile(file) : null; if (problem) { setSuccess(false); setMessage(problem); event.target.value = ""; return; } setAvatarFile(file); setAvatarPreview(file ? URL.createObjectURL(file) : avatarUrl); setMessage(""); }} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:font-black file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-400">JPG, PNG or WebP · maximum 5 MB</span></span>
          </span>
        </label>
        <label className="block text-sm font-bold text-slate-300">
          Profile name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={50}
            required
            autoComplete="name"
            className={inputClass}
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">
            The name shown at the top of your profile.
          </span>
        </label>

        <label className="block text-sm font-bold text-slate-300">
          CueBracket username
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black text-cyan-300">@</span>
            <input
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9_]{3,24}"
              required
              autoComplete="username"
              className={`${inputClass} pl-9`}
            />
          </div>
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">
            Unique. Use lowercase letters, numbers and underscores.
          </span>
        </label>

        <label className="block text-sm font-bold text-slate-300 sm:col-span-2">
          Preferred tournament name
          <input
            value={tournamentName}
            onChange={(event) => setTournamentName(event.target.value)}
            minLength={2}
            maxLength={40}
            required
            placeholder="The Shark"
            className={inputClass}
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">
            This will be offered automatically when you register for an event. You can still choose a different name for a particular tournament.
          </span>
        </label>

        <label className="block text-sm font-bold text-slate-300 sm:col-span-2">
          Short player bio <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Pool player, home club or favourite discipline."
            className={`${inputClass} resize-none`}
          />
          <span className="mt-2 flex justify-between text-xs font-normal leading-5 text-slate-400">
            <span>Visible only when your profile is public.</span>
            <span>{bio.length}/160</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:col-span-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-1 h-4 w-4 accent-cyan-400"
          />
          <span>
            <span className="block text-sm font-black text-white">Public player profile</span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              Allow players and organizers to open your CueBracket profile. Your email is never displayed.
            </span>
          </span>
        </label>

        {message ? (
          <div
            role="status"
            className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 sm:col-span-2 ${
              success
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/20 bg-rose-400/10 text-rose-200"
            }`}
          >
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start sm:px-8"
        >
          {busy ? "Saving profile…" : "Save player profile"}
        </button>
      </form>
    </section>
  );
}
