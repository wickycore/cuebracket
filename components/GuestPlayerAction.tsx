"use client";

import { useState } from "react";

export function GuestPlayerAction({
  playerName,
  tournamentName,
  returnPath,
  isOrganizer,
  isSignedIn,
}: {
  playerName: string;
  tournamentName: string;
  returnPath: string;
  isOrganizer: boolean;
  isSignedIn: boolean;
}) {
  const [message, setMessage] = useState("");
  const destination = isSignedIn
    ? "/account"
    : `/auth/signup?next=${encodeURIComponent(returnPath)}`;

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

  return (
    <a data-cb-hard-navigation="true" href={destination} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#39a8ff] px-5 py-3 text-sm font-black text-[#06182c] transition hover:bg-[#62c4ff]">
      {isSignedIn ? "Open your profile" : "Claim your profile"}
    </a>
  );
}
