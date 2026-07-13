"use client";

import { useEffect, useState } from "react";
import type {
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js";
import { ReadOnlyBracket } from "@/components/ReadOnlyBracket";
import {
  getPublicCloudTournament,
  rowToTournament,
  type CloudTournamentRow,
} from "@/lib/cloud/tournaments";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "live" | "reconnecting";

export function RealtimeCloudTournament({ id }: { id: string }) {
  const [row, setRow] = useState<CloudTournamentRow | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    getPublicCloudTournament(id)
      .then((data) => {
        if (!active) return;
        setRow(data);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("This tournament is private, unavailable or has been removed.");
      });

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
            setError("This tournament is no longer available.");
            return;
          }

          setRow(payload.new as unknown as CloudTournamentRow);
          setError("");
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
      void supabase.removeChannel(channel);
    };
  }, [id]);

  if (error) {
    return (
      <p className="rounded-2xl border border-rose-400/10 bg-rose-400/10 p-5 font-semibold text-rose-300">
        {error}
      </p>
    );
  }

  if (!row) {
    return (
      <p className="animate-pulse text-slate-400">
        Connecting to live tournament...
      </p>
    );
  }

  const tournament = rowToTournament(row);

  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                connection === "live"
                  ? "animate-pulse bg-emerald-400/10 text-emerald-300"
                  : "bg-amber-400/10 text-amber-300"
              }`}
            >
              {connection === "live" ? "● Realtime" : "● Reconnecting"}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">
              Public read-only
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-black text-white">{tournament.name}</h1>
          <p className="mt-2 text-slate-400">
            {tournament.venue || "Venue not set"} · Race to {tournament.raceTo}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Status
          </p>
          <p className="mt-1 font-black capitalize text-cyan-300">
            {tournament.status}
          </p>
        </div>
      </div>

      <ReadOnlyBracket tournament={tournament} />
    </>
  );
}
