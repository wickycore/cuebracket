"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getTournamentAccessRole,
  getTournamentCollaborators,
  inviteTournamentCoOrganizer,
  removeTournamentCollaborator,
  type TournamentCollaboratorView,
} from "@/lib/cloud/collaborators";
import type { Tournament } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onAccessRoleChange?: (role: "owner" | "co_organizer" | null) => void;
}

export function TournamentCollaborators({ tournament, onAccessRoleChange }: Props) {
  const [role, setRole] = useState<"owner" | "co_organizer" | null>(null);
  const [collaborators, setCollaborators] = useState<TournamentCollaboratorView[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const accessRole = await getTournamentAccessRole(tournament.id);
      setRole(accessRole);
      onAccessRoleChange?.(accessRole);
      if (accessRole === "owner") {
        setCollaborators(await getTournamentCollaborators(tournament.id));
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to load co-organizers.";
      if (!text.toLowerCase().includes("sign in")) setMessage(text);
    }
  }, [onAccessRoleChange, tournament.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function invite() {
    if (!username.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      await inviteTournamentCoOrganizer(tournament, username);
      setUsername("");
      setMessage("Invitation sent. They can accept it from the Cloud center.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send this invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: TournamentCollaboratorView) {
    const name = row.tournamentName || row.displayName;
    if (!window.confirm(`Remove ${name} as a co-organizer?`)) return;
    setBusy(true);
    try {
      await removeTournamentCollaborator(row.id);
      setCollaborators((current) => current.filter((item) => item.id !== row.id));
      setMessage(`${name} no longer has tournament access.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this co-organizer.");
    } finally {
      setBusy(false);
    }
  }

  if (role === "co_organizer") {
    return (
      <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3 text-sm font-bold text-violet-100">
        Co-organizer access · You can run matches, record scores and assign tables. Tournament ownership and setup stay protected.
      </div>
    );
  }

  if (role !== "owner") return null;

  return (
    <details className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/[0.045] p-4 sm:p-5">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-black text-white">Co-organizers</span>
            <span className="mt-1 block text-xs font-bold text-slate-400">Invite trusted CueBracket users to run matches and tables.</span>
          </span>
          <span className="rounded-full bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-200">{collaborators.filter((row) => row.status === "accepted").length} active</span>
        </span>
      </summary>
      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">CueBracket username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Exact username, e.g. @wicky" className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-violet-300/45" />
          </label>
          <button type="button" disabled={busy || !username.trim()} onClick={() => void invite()} className="rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40">{busy ? "Working…" : "Send invitation"}</button>
        </div>
        {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-300">{message}</p> : null}
        {collaborators.length ? (
          <div className="mt-5 space-y-2">
            {collaborators.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3.5">
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{row.tournamentName || row.displayName}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-400">{row.username ? `@${row.username} · ` : ""}{row.status}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => void remove(row)} className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-40">Remove</button>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-slate-400">Only you can manage this tournament right now.</p>}
      </div>
    </details>
  );
}
