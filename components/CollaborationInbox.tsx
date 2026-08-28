"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMyCollaborationInvites,
  respondToCollaborationInvite,
  type TournamentCollaboratorView,
} from "@/lib/cloud/collaborators";

export function CollaborationInbox() {
  const [invites, setInvites] = useState<TournamentCollaboratorView[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    getMyCollaborationInvites()
      .then(setInvites)
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Unable to load invitations.";
        if (!text.toLowerCase().includes("sign in")) setMessage(text);
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("cuebracket:collaborations-changed", load);
    return () => window.removeEventListener("cuebracket:collaborations-changed", load);
  }, [load]);

  async function respond(invite: TournamentCollaboratorView, status: "accepted" | "declined") {
    setBusyId(invite.id);
    setMessage("");
    try {
      await respondToCollaborationInvite(invite.id, status);
      setInvites((current) => current.filter((row) => row.id !== invite.id));
      setMessage(status === "accepted"
        ? `${invite.tournamentTitle} is now in your tournament library.`
        : `Invitation to ${invite.tournamentTitle} declined.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to answer this invitation.");
    } finally {
      setBusyId("");
    }
  }

  if (!invites.length && !message) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-400/[0.06] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Co-organizer invitations</p>
      <h2 className="mt-2 text-2xl font-black text-white">Help run a tournament</h2>
      {message ? <p role="status" className="mt-4 rounded-xl bg-slate-950/45 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}
      {invites.length ? (
        <div className="mt-5 space-y-3">
          {invites.map((invite) => (
            <article key={invite.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black text-white">{invite.tournamentTitle}</h3>
                <p className="mt-1 text-sm text-slate-400">You can manage its matches, scores and table assignments.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busyId === invite.id} onClick={() => void respond(invite, "accepted")} className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">Accept</button>
                <button type="button" disabled={busyId === invite.id} onClick={() => void respond(invite, "declined")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-40">Decline</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
