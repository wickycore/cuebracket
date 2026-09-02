"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { RemoteMedia } from "@/components/RemoteMedia";

import {
  followClub,
  removeClubMember,
  requestClubMembership,
  unfollowClub,
  updateClub,
  updateClubMemberRole,
  updateMembershipRequest,
  withdrawMembershipRequest,
} from "@/lib/cloud/clubs";
import { removePublicImage, uploadPublicImage, validateImageFile } from "@/lib/cloud/media";
import { normalizeClubSlug, type ClubGuideRow, type ClubMembershipRequestRow, type ClubRole, type ClubRow } from "@/lib/clubs";

export interface ClubMemberView {
  userId: string;
  role: ClubRole;
  name: string;
  username: string | null;
  isPublic?: boolean;
  avatarUrl?: string | null;
  followerCount?: number;
}

interface Props {
  club: ClubRow;
  userId: string | null;
  isFollowing: boolean;
  ownRole: ClubRole | null;
  ownRequest: ClubMembershipRequestRow | null;
  pendingRequests: ClubMembershipRequestRow[];
  members: ClubMemberView[];
  guide?: ClubGuideRow | null;
  defaultRequestName: string;
  isAdmin: boolean;
  managementOnly?: boolean;
}

export function ClubCommunityPanel({
  club,
  userId,
  isFollowing,
  ownRole,
  ownRequest,
  pendingRequests,
  members,
  guide = null,
  defaultRequestName,
  isAdmin,
  managementOnly = false,
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(isFollowing);
  const [requestName, setRequestName] = useState(defaultRequestName);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(club.name);
  const [slug, setSlug] = useState(club.slug);
  const [location, setLocation] = useState(club.location);
  const [description, setDescription] = useState(club.description);
  const [acceptedGuide, setAcceptedGuide] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(club.logo_url ?? "");
  const guideReady = Boolean(club.location.trim() && guide?.rules.trim());

  useEffect(() => () => {
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await action();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function toggleFollow() {
    const next = !following;
    await run("follow", async () => {
      if (next) await followClub(club.id);
      else await unfollowClub(club.id);
      setFollowing(next);
    });
  }

  function submitMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("join", async () => {
      if (!guideReady || !guide || !acceptedGuide) throw new Error("Read and accept the complete club guide before joining.");
      await requestClubMembership(club.id, requestName, guide.revision);
    });
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("details", async () => {
      let uploaded: { path: string; url: string } | null = null;
      try {
        if (logoFile) uploaded = await uploadPublicImage(`clubs/${club.id}/logo`, logoFile);
        const updated = await updateClub(club.id, { name, slug, location, description, ...(uploaded ? { logoUrl: uploaded.url } : {}) });
        if (uploaded) {
          const previousLogo = club.logo_url;
          setLogoFile(null);
          setLogoPreview(uploaded.url);
          if (previousLogo && previousLogo !== uploaded.url) void removePublicImage(previousLogo).catch(() => undefined);
        }
        if (updated.slug !== club.slug) router.push(managementOnly ? `/clubs/${updated.slug}/manage` : `/clubs/${updated.slug}`);
      } catch (error) {
        if (uploaded) void removePublicImage(uploaded.url).catch(() => undefined);
        throw error;
      }
    });
  }

  return (
    <div className="space-y-5">
      {!managementOnly ? <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          {userId ? (
            <button type="button" onClick={() => void toggleFollow()} disabled={Boolean(busy)} className={`min-h-12 flex-1 rounded-2xl px-5 py-3 font-black ${following ? "border border-cyan-400/25 bg-cyan-400/10 text-cyan-200" : "bg-cyan-400 text-slate-950"}`}>
              {busy === "follow" ? "Saving…" : following ? "✓ Following" : "+ Follow club"}
            </button>
          ) : (
            <Link href={`/auth/login?next=${encodeURIComponent(`/clubs/${club.slug}`)}`} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
              Sign in to follow
            </Link>
          )}
        </div>

        {ownRole ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
            You are a club {ownRole === "owner" ? "owner" : ownRole}.
          </div>
        ) : ownRequest?.status === "pending" ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-sm font-bold text-amber-100">Membership request pending as {ownRequest.request_name}.</p>
            <button type="button" onClick={() => void run("withdraw", async () => { await withdrawMembershipRequest(ownRequest.id); })} disabled={Boolean(busy)} className="mt-3 text-sm font-black text-amber-200 underline underline-offset-4">
              {busy === "withdraw" ? "Withdrawing…" : "Withdraw request"}
            </button>
          </div>
        ) : userId ? (
          <form onSubmit={submitMembership} className="mt-4 border-t border-white/10 pt-4">
            {guideReady && guide ? (
              <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/55">
                <div className="border-b border-white/10 px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Required before joining</p><p className="mt-1 text-sm font-black text-white">Read the club guide</p></div>
                <div className="max-h-64 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-6 text-slate-400">
                  <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Location</p><p className="mt-1 font-bold text-slate-200">📍 {club.location}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.location)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-black text-cyan-300">Open in Maps ↗</a></div>
                  <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Opening hours</p><p className="mt-1 whitespace-pre-wrap">{guide.opening_hours || "Ask the organizer for opening hours."}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">House rules and joining guide</p><p className="mt-1 whitespace-pre-wrap">{guide.rules}</p></div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 border-t border-white/10 px-4 py-4 text-sm font-bold text-slate-200"><input type="checkbox" checked={acceptedGuide} onChange={(event) => setAcceptedGuide(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" /><span>I have read and accept the location information, opening hours and club rules.</span></label>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold leading-6 text-amber-100">Membership requests will open after the organizer publishes the club location and joining guide.</div>
            )}
            <label className="text-sm font-bold text-slate-300">
              Name to show the club organizer
              <input value={requestName} onChange={(event) => setRequestName(event.target.value)} minLength={2} maxLength={50} required className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-white outline-none focus:border-cyan-400/50" />
            </label>
            <button type="submit" disabled={Boolean(busy) || !guideReady || !acceptedGuide} className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 font-black text-white hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45">
              {busy === "join" ? "Sending…" : "Request club membership"}
            </button>
          </form>
        ) : (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-400">Following keeps you connected to public events. Membership is optional and approved by the club organizer.</p>
        )}

      </section> : null}

      {message ? <p role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-100">{message}</p> : null}

      {isAdmin ? (
        <section className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/[0.045] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Organizer controls</p>
          <h2 className="mt-2 text-xl font-black">Keep club work simple.</h2>

          <div className="mt-5">
            <h3 className="font-black">Membership requests <span className="text-cyan-300">{pendingRequests.length}</span></h3>
            {pendingRequests.length ? (
              <div className="mt-3 space-y-2">
                {pendingRequests.map((request) => {
                  const acceptedCurrentGuide = Boolean(guide && request.guide_accepted_at && request.accepted_guide_revision === guide.revision);
                  return <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{request.request_name}</p>
                      <p className="mt-1 text-xs text-slate-400">Requested {new Date(request.created_at).toLocaleDateString("en-KE")} · {acceptedCurrentGuide ? `Accepted guide v${guide?.revision}` : "Needs the latest guide"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void run(`approve-${request.id}`, async () => { await updateMembershipRequest(request.id, "approved"); })} disabled={Boolean(busy) || !acceptedCurrentGuide} title={acceptedCurrentGuide ? "Approve membership" : "The player must withdraw and accept the latest guide before approval."} className="min-h-11 flex-1 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Approve</button>
                      <button type="button" onClick={() => void run(`reject-${request.id}`, async () => { await updateMembershipRequest(request.id, "rejected"); })} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl border border-rose-300/20 px-4 py-2 text-sm font-black text-rose-200">Decline</button>
                    </div>
                  </div>
                })}
              </div>
            ) : <p className="mt-2 text-sm text-slate-400">No one is waiting for approval.</p>}
          </div>

          <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <summary className="cursor-pointer font-black">Edit club details</summary>
            <form onSubmit={saveDetails} className="mt-4 grid gap-4">
              <label className="text-sm font-bold text-slate-300">Club name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 outline-none" /></label>
              <label className="text-sm font-bold text-slate-300">Public link<input value={slug} onChange={(event) => setSlug(normalizeClubSlug(event.target.value))} minLength={3} maxLength={48} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 outline-none" /></label>
              <label className="text-sm font-bold text-slate-300">Location<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 outline-none" /></label>
              <label className="text-sm font-bold text-slate-300">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 outline-none" /></label>
              <label className="text-sm font-bold text-slate-300">Club logo or image <span className="font-normal text-slate-400">(optional)</span><span className="mt-2 flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950 p-3">{logoPreview ? <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900"><img src={logoPreview} alt="Club logo preview" className="h-full w-full object-cover" /></span> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cyan-400/10 text-2xl font-black text-cyan-200">{name.charAt(0).toUpperCase()}</span>}<span className="min-w-0 flex-1"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; const problem = file ? validateImageFile(file) : null; if (problem) { setMessage(problem); event.target.value = ""; return; } setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : club.logo_url ?? ""); setMessage(""); }} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:font-black file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-400">JPG, PNG or WebP · maximum 5 MB</span></span></span></label>
              <button type="submit" disabled={Boolean(busy)} className="min-h-11 rounded-xl bg-cyan-400 px-4 py-2 font-black text-slate-950">{busy === "details" ? "Saving…" : "Save club details"}</button>
            </form>
          </details>

          <details className="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <summary className="cursor-pointer font-black">Manage members ({members.length})</summary>
            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-cyan-400/10 font-black text-cyan-200">{member.avatarUrl ? <RemoteMedia src={member.avatarUrl} alt={` profile picture`} width={88} height={88} sizes="44px" /> : member.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0"><span className="block truncate font-bold">{member.name}</span><span className="text-xs font-black uppercase tracking-wider text-slate-400">{member.role} · {member.followerCount ?? 0} followers</span></span>
                  </div>
                  {member.role !== "owner" && member.userId !== userId ? (
                    <div className="flex gap-2">
                      <select value={member.role} onChange={(event) => void run(`role-${member.userId}`, async () => { await updateClubMemberRole(club.id, member.userId, event.target.value as "admin" | "member"); })} disabled={Boolean(busy)} className="min-h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm font-bold">
                        <option value="member">Member</option><option value="admin">Admin</option>
                      </select>
                      <button type="button" onClick={() => void run(`remove-${member.userId}`, async () => { await removeClubMember(club.id, member.userId); })} disabled={Boolean(busy)} className="rounded-xl border border-rose-300/20 px-3 text-sm font-black text-rose-200">Remove</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
