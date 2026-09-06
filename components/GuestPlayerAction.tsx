"use client";

import { useState } from "react";

import { submitPlayerProfileClaim, type PlayerProfileClaimStatus } from "@/lib/cloud/profile-claims";

export function GuestPlayerAction({
  playerName,
  tournamentName,
  returnPath,
  isOrganizer,
  isSignedIn,
  tournamentId,
  registrationId,
  initialClaimStatus,
  claimable,
}: {
  playerName: string;
  tournamentName: string;
  returnPath: string;
  isOrganizer: boolean;
  isSignedIn: boolean;
  tournamentId: string;
  registrationId: string | null;
  initialClaimStatus: PlayerProfileClaimStatus | null;
  claimable: boolean;
}) {
  const [message, setMessage] = useState("");
  const [claimStatus, setClaimStatus] = useState(initialClaimStatus);
  const [busy, setBusy] = useState(false);
  const destination = `/auth/signup?next=${encodeURIComponent(returnPath)}`;

  async function invite() {
    const signupUrl = `${window.location.origin}/auth/signup?next=${encodeURIComponent(returnPath)}`;
    const shareData = {
      title: `Join ${tournamentName} on CueBracket`,
      text: `${playerName}, create your CueBracket player profile and keep your tournament record.`,
      url: signupUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setMessage("Invite opened.");
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${signupUrl}`);
        setMessage("Invite link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Could not share the invite. Please try again.");
    }
  }

  async function claim() {
    if (!registrationId) return;
    setBusy(true);
    setMessage("");
    try {
      const created = await submitPlayerProfileClaim(tournamentId, registrationId);
      setClaimStatus(created.status);
      setMessage("Request sent. The tournament organizer must verify it before results are linked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send this claim. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isOrganizer) {
    return (
      <div>
        <button type="button" onClick={() => void invite()} className="min-h-12 w-full rounded-xl bg-[#39a8ff] px-5 py-3 text-sm font-black text-[#06182c] transition hover:bg-[#62c4ff]">
          Invite {playerName} to CueBracket
        </button>
        {message ? <p role="status" className="mt-2 text-center text-xs font-bold text-[#9fc2df]">{message}</p> : null}
      </div>
    );
  }

  if (!isSignedIn) return <a data-cb-hard-navigation="true" href={destination} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#39a8ff] px-5 py-3 text-sm font-black text-[#06182c] transition hover:bg-[#62c4ff]">Sign up to claim this entry</a>;

  if (!claimable) return <p className="rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-[#9fb4ca]">This tournament entry is already linked to a player.</p>;

  return (
    <div>
      <button type="button" disabled={busy || claimStatus === "pending" || !registrationId} onClick={() => void claim()} className="min-h-12 w-full rounded-xl bg-[#39a8ff] px-5 py-3 text-sm font-black text-[#06182c] transition hover:bg-[#62c4ff] disabled:cursor-not-allowed disabled:opacity-55">
        {busy ? "Sending…" : claimStatus === "pending" ? "Awaiting organizer verification" : claimStatus === "rejected" ? "Request verification again" : registrationId ? "Claim this tournament entry" : "Entry cannot be claimed yet"}
      </button>
      {message ? <p role="status" className="mt-2 text-center text-xs font-bold text-[#9fc2df]">{message}</p> : null}
    </div>
  );
}
