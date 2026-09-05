"use client";


import { useCallback, useEffect, useState } from "react";
import { RemoteMedia } from "@/components/RemoteMedia";
import type {
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js";
import { ReadOnlyBracket } from "@/components/ReadOnlyBracket";
import { ReadOnlyCompetition } from "@/components/ReadOnlyCompetition";
import {
  getPublicCloudTournament,
  rowToTournament,
  type CloudTournamentRow,
} from "@/lib/cloud/tournaments";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "live" | "reconnecting";
type LoadState = "ready" | "not_found" | "unavailable" | "loading";
const LOAD_TIMEOUT_MS = 8_000;

export function RealtimeCloudTournament({
  id,
  initialRow,
  initialState,
}: {
  id: string;
  initialRow: CloudTournamentRow | null;
  initialState: "ready" | "not_found" | "unavailable";
}) {
  const [row, setRow] = useState<CloudTournamentRow | null>(initialRow);
  const [loadState, setLoadState] = useState<LoadState>(
    initialRow ? "ready" : initialState === "not_found" ? "not_found" : "loading",
  );
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [offline, setOffline] = useState(false);

  const retry = useCallback(() => {
    setLoadState(row ? "ready" : "loading");
    setConnection("connecting");
    setAttempt((value) => value + 1);
  }, [row]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const updateOnlineState = () => setOffline(!window.navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    if (!initialRow || attempt > 0) {
      timeout = setTimeout(() => {
        if (!active) return;
        setLoadState("unavailable");
        setConnection("reconnecting");
      }, LOAD_TIMEOUT_MS);

      getPublicCloudTournament(id)
      .then((data) => {
        if (!active) return;
        if (timeout) clearTimeout(timeout);
        setRow(data);
        setLoadState("ready");
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (timeout) clearTimeout(timeout);
        const code = requestError && typeof requestError === "object" && "code" in requestError
          ? String(requestError.code)
          : "";
        setLoadState(code === "PGRST116" ? "not_found" : "unavailable");
      });
    }

    const channel = supabase
      .channel(`cloud-tournament-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cloud_tournaments",
          filter: `id=eq.${id}`,
        },
        (payload: RealtimePostgresChangesPayload<CloudTournamentRow>) => {
          if (!active) return;

          if (payload.eventType === "DELETE") {
            setRow(null);
            setLoadState("not_found");
            return;
          }

          const nextRow = payload.new as unknown as CloudTournamentRow;
          if (!nextRow.is_public) {
            setRow(null);
            setLoadState("not_found");
            return;
          }
          setRow(nextRow);
          setLoadState("ready");
        },
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (!active) return;
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
        }
      });

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      void supabase.removeChannel(channel);
    };
  }, [attempt, id, initialRow]);

  if (offline && !row) {
    return (
      <SpectatorStateCard
        icon="📡"
        title="You’re offline"
        message="Reconnect to the internet, then try loading this public tournament again."
        action="Try again"
        onAction={retry}
      />
    );
  }

  if (!row) {
    if (loadState === "not_found") {
      return <SpectatorStateCard icon="🎱" title="Tournament not found" message="This link may be incorrect, private, expired or removed." action="Try again" onAction={retry} />;
    }
    if (loadState === "unavailable") {
      return <SpectatorStateCard icon="↻" title="We couldn’t connect" message="The tournament service took too long to respond. Your link is safe—please retry." action="Retry connection" onAction={retry} />;
    }
    return (
      <div aria-live="polite" className="rounded-[1.75rem] border border-[#2a5680] bg-[#0d2a50] p-6 sm:p-8">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#52d3ee]/20" />
        <div className="mt-5 h-10 max-w-xl animate-pulse rounded-xl bg-white/10" />
        <div className="mt-3 h-5 max-w-sm animate-pulse rounded-lg bg-white/5" />
        <p className="mt-6 text-sm font-bold text-[#b8c7dc]">Connecting to tournament…</p>
      </div>
    );
  }

  const tournament = rowToTournament(row);
  const eliminationLabel = tournament.bracket?.type === "single"
    ? "Single Elimination"
    : tournament.bracket?.type === "double"
      ? "Double Elimination"
      : null;

  return (
    <>
      {offline ? <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"><span>Offline—showing the latest loaded scores.</span><button type="button" onClick={retry} className="shrink-0 text-[#52d3ee]">Reconnect</button></div> : null}
      {tournament.posterUrl ? <div className="mb-5 h-48 overflow-hidden rounded-[1.75rem] border border-[#2a5680] bg-[#10305a] sm:mb-8 sm:h-72"><RemoteMedia src={tournament.posterUrl} alt={`${tournament.name} poster`} sizes="(max-width: 768px) 100vw, 72rem" /></div> : null}
      <div className="mb-5 flex items-end justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-black uppercase sm:px-3 sm:text-xs ${
                connection === "live"
                  ? "bg-[#78c69b]/12 text-[#9fd7b7]"
                  : "bg-amber-300/10 text-amber-200"
              }`}
            >
              {connection === "live" ? "● Realtime" : connection === "connecting" ? "● Connecting" : "● Reconnecting"}
            </span>
            <span className="hidden rounded-full bg-[#11335d] px-3 py-1 text-xs font-bold text-[#d2dfec] sm:inline">
              Public read-only
            </span>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-4">
            <h1 className="min-w-0 truncate text-3xl font-black text-[#fafcff] sm:text-4xl">{tournament.name}</h1>
            {eliminationLabel ? <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-[#52d3ee] sm:text-sm">· {eliminationLabel}</span> : null}
          </div>
          <p className="mt-1 truncate text-sm text-[#d2dfec] sm:mt-2 sm:text-base">
            {tournament.venue || "Venue not set"} · Race to {tournament.raceTo}
          </p>
        </div>

        <div className="shrink-0 rounded-xl border border-[#2a5680] bg-[#10305a] px-3 py-2 sm:rounded-2xl sm:px-5 sm:py-4">
          <p className="hidden text-xs font-black uppercase tracking-wider text-[#9fb4ca] sm:block">
            Status
          </p>
          <p className="text-sm font-black capitalize text-[#52d3ee] sm:mt-1 sm:text-base">
            {tournament.status}
          </p>
        </div>
      </div>

      {tournament.status === "draft" ? (
        <SpectatorStateCard icon="🗓️" title="Tournament not started yet" message="The organizer is preparing this event. This page will update automatically when the bracket goes live." />
      ) : tournament.status === "completed" ? (
        <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-100 sm:mb-7"><strong className="font-black">Final results</strong> · This tournament has finished. The completed bracket and scores remain available below.</div>
      ) : null}

      {tournament.status !== "draft" ? (tournament.bracket ? <ReadOnlyBracket tournament={tournament} /> : tournament.competition ? <ReadOnlyCompetition tournament={tournament} /> : <SpectatorStateCard icon="⏳" title="Bracket is being prepared" message="The organizer has started the event, but fixtures have not been published yet." />) : null}
    </>
  );
}

function SpectatorStateCard({ icon, title, message, action, onAction }: { icon: string; title: string; message: string; action?: string; onAction?: () => void }) {
  return (
    <section role="status" className="rounded-[1.75rem] border border-[#2a5680] bg-[#0d2a50] px-6 py-12 text-center sm:px-8 sm:py-16">
      <p className="text-4xl" aria-hidden="true">{icon}</p>
      <h1 className="mt-4 text-2xl font-black text-[#fafcff]">{title}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#b8c7dc] sm:text-base">{message}</p>
      {action && onAction ? <button type="button" onClick={onAction} className="mt-6 rounded-xl bg-[#52d3ee] px-5 py-3 text-sm font-black text-[#071a35]">{action}</button> : null}
    </section>
  );
}
