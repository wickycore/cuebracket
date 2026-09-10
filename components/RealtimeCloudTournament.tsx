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
import {
  loadPublicTournamentParticipants,
  type PublicTournamentParticipant,
} from "@/lib/cloud/public-participants";

type ConnectionState = "connecting" | "live" | "reconnecting";
type LoadState = "ready" | "not_found" | "unavailable" | "loading";
const LOAD_TIMEOUT_MS = 8_000;
const SAFETY_REFRESH_MS = 30_000;

export function RealtimeCloudTournament({
  id,
  initialRow,
  initialState,
  initialParticipants,
}: {
  id: string;
  initialRow: CloudTournamentRow | null;
  initialState: "ready" | "not_found" | "unavailable";
  initialParticipants: PublicTournamentParticipant[];
}) {
  const [row, setRow] = useState<CloudTournamentRow | null>(initialRow);
  const [loadState, setLoadState] = useState<LoadState>(
    initialRow ? "ready" : initialState === "not_found" ? "not_found" : "loading",
  );
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [participants, setParticipants] = useState(initialParticipants);

  const retry = useCallback(() => {
    setLoadState(row ? "ready" : "loading");
    setConnection("connecting");
    setAttempt((value) => value + 1);
  }, [row]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let hasLoadedRow = Boolean(initialRow);
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const applyFreshRow = (nextRow: CloudTournamentRow) => {
      if (!active) return;
      hasLoadedRow = true;
      setRow((current) => {
        if (!current) return nextRow;
        const currentTime = Date.parse(current.updated_at);
        const nextTime = Date.parse(nextRow.updated_at);
        return !Number.isFinite(currentTime) ||
          !Number.isFinite(nextTime) ||
          nextTime >= currentTime
          ? nextRow
          : current;
      });
      setLoadState("ready");
    };

    const refreshFromCloud = async () => {
      if (!active || !window.navigator.onLine) return;
      try {
        const nextRow = await getPublicCloudTournament(id);
        if (timeout) clearTimeout(timeout);
        applyFreshRow(nextRow);
      } catch (requestError: unknown) {
        if (!active) return;
        if (timeout) clearTimeout(timeout);
        const code = requestError && typeof requestError === "object" && "code" in requestError
          ? String(requestError.code)
          : "";
        if (code === "PGRST116") {
          hasLoadedRow = false;
          setRow(null);
          setLoadState("not_found");
        } else if (!hasLoadedRow) {
          setLoadState("unavailable");
        }
        setConnection("reconnecting");
      }
    };

    if (!hasLoadedRow) {
      timeout = setTimeout(() => {
        if (!active) return;
        setLoadState("unavailable");
        setConnection("reconnecting");
      }, LOAD_TIMEOUT_MS);
    }

    const handleOnline = () => {
      setOffline(false);
      setConnection("connecting");
      void refreshFromCloud();
    };
    const handleOffline = () => {
      setOffline(true);
      setConnection("reconnecting");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshFromCloud();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    void refreshFromCloud();

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
            hasLoadedRow = false;
            setRow(null);
            setLoadState("not_found");
            return;
          }

          const nextRow = payload.new as unknown as CloudTournamentRow;
          if (!nextRow.is_public) {
            hasLoadedRow = false;
            setRow(null);
            setLoadState("not_found");
            return;
          }
          applyFreshRow(nextRow);
        },
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnection("live");
          // A fresh read after every (re)subscription recovers any update that
          // happened while the WebSocket was unavailable.
          void refreshFromCloud();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnection("reconnecting");
          void refreshFromCloud();
        }
      });

    const safetyRefresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshFromCloud();
    }, SAFETY_REFRESH_MS);

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      window.clearInterval(safetyRefresh);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [attempt, id, initialRow]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const refreshParticipants = () => {
      void loadPublicTournamentParticipants(supabase, id).then((next) => {
        if (active) setParticipants(next);
      }).catch(() => undefined);
    };

    refreshParticipants();
    const channel = supabase
      .channel(`public-tournament-participants-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_registrations", filter: `tournament_id=eq.${id}` },
        refreshParticipants,
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [id]);

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
      ) : null}

      {tournament.status !== "draft" ? (tournament.bracket ? <ReadOnlyBracket tournament={tournament} publicParticipants={participants} enablePlayerCards /> : tournament.competition ? <ReadOnlyCompetition tournament={tournament} /> : <SpectatorStateCard icon="⏳" title="Bracket is being prepared" message="The organizer has started the event, but fixtures have not been published yet." />) : null}
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
