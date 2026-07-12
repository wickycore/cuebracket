"use client";

import { useEffect, useState } from "react";
import {
  addTable,
  getTables,
  PoolTable,
  removeTable,
  subscribeToTables,
  TableStatus,
  updateTable,
} from "@/lib/tableManagement";

const style: Record<TableStatus, string> = {
  available: "border-emerald-400/25 bg-emerald-400/5 text-emerald-300",
  playing: "border-cyan-400/25 bg-cyan-400/5 text-cyan-300",
  reserved: "border-amber-400/25 bg-amber-400/5 text-amber-300",
};

export function TableManager({ compact = false }: { compact?: boolean }) {
  const [tables, setTables] = useState<PoolTable[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    const load = () => setTables(getTables());
    load();
    return subscribeToTables(load);
  }, []);

  function create() {
    addTable(name);
    setName("");
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Venue control</p>
          <h2 className="mt-2 text-2xl font-black text-white">Pool tables</h2>
          <p className="mt-1 text-sm text-slate-400">See which tables are free, playing or reserved.</p>
        </div>
        {!compact ? (
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Table ${tables.length + 1}`}
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
            />
            <button onClick={create} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">
              Add
            </button>
          </div>
        ) : null}
      </div>

      {tables.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tables.slice(0, compact ? 4 : undefined).map((table) => (
            <article key={table.id} className={`rounded-2xl border p-4 ${style[table.status]}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-white">{table.name}</h3>
                <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider">
                  {table.status}
                </span>
              </div>
              {!compact ? (
                <>
                  <select
                    value={table.status}
                    onChange={(event) =>
                      updateTable(table.id, { status: event.target.value as TableStatus })
                    }
                    className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-bold text-white"
                  >
                    <option value="available">Available</option>
                    <option value="playing">Playing</option>
                    <option value="reserved">Reserved</option>
                  </select>
                  <input
                    value={table.note ?? ""}
                    onChange={(event) => updateTable(table.id, { note: event.target.value })}
                    placeholder="Match or note"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={() => removeTable(table.id)}
                    className="mt-3 text-xs font-bold text-rose-300"
                  >
                    Remove table
                  </button>
                </>
              ) : (
                <p className="mt-3 truncate text-xs opacity-75">{table.note || "No match assigned"}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
          No tables added yet.
        </div>
      )}
    </section>
  );
}
