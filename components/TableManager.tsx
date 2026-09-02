"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClubRow } from "@/lib/clubs";
import { getManagedClubs } from "@/lib/cloud/clubs";
import {
  createVenueTable,
  deleteVenueTable,
  getManagedVenueTables,
  releaseVenueTable,
  subscribeToVenueTables,
  updateVenueTable,
  type VenueTableRow,
  type VenueTableStatus,
} from "@/lib/cloud/tables";

const style: Record<VenueTableStatus, string> = {
  available: "border-emerald-400/25 bg-emerald-400/[0.055] text-emerald-300",
  playing: "border-cyan-400/25 bg-cyan-400/[0.055] text-cyan-300",
  reserved: "border-amber-400/25 bg-amber-400/[0.055] text-amber-300",
};

export function TableManager({ compact = false, clubId = null }: { compact?: boolean; clubId?: string | null }) {
  const [tables, setTables] = useState<VenueTableRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState(clubId ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [nextTables, nextClubs] = await Promise.all([getManagedVenueTables(), getManagedClubs()]);
      setTables(clubId ? nextTables.filter((table) => table.club_id === clubId) : nextTables);
      setClubs(nextClubs);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load venue tables.");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const unsubscribe = subscribeToVenueTables(() => void load());
    return () => {
      window.clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [load]);

  const clubNames = useMemo(() => new Map(clubs.map((club) => [club.id, club.name])), [clubs]);
  const counts = useMemo(() => ({
    available: tables.filter((table) => table.status === "available").length,
    playing: tables.filter((table) => table.status === "playing").length,
    reserved: tables.filter((table) => table.status === "reserved").length,
  }), [tables]);

  async function create() {
    setMessage("");
    try {
      await createVenueTable({ clubId: clubId ?? (scope || null), name: name || `Table ${tables.length + 1}`, sortOrder: tables.length });
      setName("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add this table.");
    }
  }

  async function update(id: number, updates: Partial<Pick<VenueTableRow, "name" | "status" | "note">>) {
    try {
      await updateVenueTable(id, updates);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this table.");
    }
  }

  async function release(table: VenueTableRow) {
    if (!table.active_event_type || !table.active_event_id || !table.active_match_id) return;
    try {
      await releaseVenueTable({
        tableId: table.id,
        scope: { id: table.active_event_id, clubId: table.club_id, type: table.active_event_type },
        matchId: table.active_match_id,
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to release this table.");
    }
  }

  async function remove(table: VenueTableRow) {
    if (table.active_match_id) return setMessage("Release the active match before removing this table.");
    if (!window.confirm(`Remove ${table.name}?`)) return;
    try {
      await deleteVenueTable(table.id);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this table.");
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Live floor control</p>
          <h2 className="mt-2 text-2xl font-black text-white">Venue tables</h2>
          <p className="mt-1 text-sm text-slate-400">Assignments now follow the match, update every organizer in realtime and release automatically after the result.</p>
        </div>
        {!compact ? (
          <div className={`grid gap-2 ${clubId ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[11rem_minmax(0,1fr)_auto]"}`}>
            {clubId ? null : <select value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm font-bold text-white">
              <option value="">My independent venue</option>
              {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>}
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Table ${tables.length + 1}`} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" />
            <button onClick={create} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">Add table</button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {(["available", "playing", "reserved"] as VenueTableStatus[]).map((status) => (
          <div key={status} className={`rounded-2xl border p-3 text-center ${style[status]}`}><p className="text-2xl font-black text-white">{counts[status]}</p><p className="mt-1 text-xs font-black uppercase tracking-wider">{status}</p></div>
        ))}
      </div>

      {message ? <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm font-bold text-amber-200">{message}</p> : null}

      {loading ? <p className="mt-6 animate-pulse text-sm text-slate-400">Loading the venue floor...</p> : tables.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tables.slice(0, compact ? 4 : undefined).map((table) => (
            <article key={table.id} className={`rounded-2xl border p-4 ${style[table.status]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {compact ? <h3 className="truncate font-black text-white">{table.name}</h3> : <input defaultValue={table.name} onBlur={(event) => { if (event.target.value.trim() !== table.name) void update(table.id, { name: event.target.value }); }} aria-label={`${table.name} name`} className="w-full bg-transparent font-black text-white outline-none" />}
                  <p className="mt-1 truncate text-xs font-black uppercase tracking-wider text-slate-400">{table.club_id ? clubNames.get(table.club_id) ?? "Club venue" : "Independent venue"}</p>
                </div>
                <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider">{table.status}</span>
              </div>

              {table.active_match_id ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">{table.active_event_type}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-black text-white">{table.active_match_label || "Assigned match"}</p>
                </div>
              ) : null}

              {!compact ? (
                <>
                  {!table.active_match_id ? (
                    <select value={table.status} onChange={(event) => void update(table.id, { status: event.target.value as VenueTableStatus })} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-bold text-white">
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  ) : <button onClick={() => void release(table)} className="mt-4 w-full rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-black text-emerald-200">Release table</button>}
                  <input defaultValue={table.note} onBlur={(event) => { if (event.target.value.trim() !== table.note) void update(table.id, { note: event.target.value }); }} placeholder="Floor note" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" />
                  <button onClick={() => void remove(table)} className="mt-3 text-xs font-bold text-rose-300">Remove table</button>
                </>
              ) : <p className="mt-3 truncate text-xs opacity-75">{table.active_match_label || table.note || "No match assigned"}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">No cloud venue tables yet. Add the physical tables your tournaments use.</div>
      )}
    </section>
  );
}
