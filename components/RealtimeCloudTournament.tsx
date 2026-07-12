"use client";

import { useEffect, useState } from "react";
import { ReadOnlyBracket } from "@/components/ReadOnlyBracket";
import {
  CloudTournamentRow,
  getPublicCloudTournament,
  rowToTournament,
} from "@/lib/cloud/tournaments";
import { createClient } from "@/lib/supabase/client";

export function RealtimeCloudTournament({ id }: { id: string }) {
  const [row, setRow] = useState<CloudTournamentRow | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    getPublicCloudTournament(id)
      .then((data) => {
        if (active) setRow(data);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Tournament unavailable.");
        }
      });

    const channel = supabase
      .channel(`cloud-tournament-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cloud_tournaments",
          filter: `id=eq.${id}`,
        },
        (payload) => setRow(payload.new as CloudTournamentRow),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  if (error) {
    return <p className="rounded-2xl bg-rose-400/10 p-5 text-rose-300">{error}</p>;
  }

  if (!row) {
    return <p className="animate-pulse text-slate-400">Connecting to live tournament...</p>;
  }

  const tournament = rowToTournament(row);

  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="animate-pulse rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">
              ● Realtime
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
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Status</p>
          <p className="mt-1 font-black capitalize text-cyan-300">{tournament.status}</p>
        </div>
      </div>

      <ReadOnlyBracket tournament={tournament} />
    </>
  );
}
