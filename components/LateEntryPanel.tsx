"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { LateEntryByeSlot } from "@/lib/bracket/lateEntry";

export function LateEntryPanel({
  slots,
  remainingCapacity,
  onAdd,
}: {
  slots: LateEntryByeSlot[];
  remainingCapacity: number;
  onAdd: (playerName: string, matchId: string) => string | null;
}) {
  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.available),
    [slots],
  );
  const lockedSlots = useMemo(
    () => slots.filter((slot) => !slot.available),
    [slots],
  );
  const [name, setName] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (
      selectedMatchId &&
      availableSlots.some((slot) => slot.matchId === selectedMatchId)
    ) {
      return;
    }
    setSelectedMatchId(availableSlots[0]?.matchId ?? "");
  }, [availableSlots, selectedMatchId]);

  if (slots.length === 0 || remainingCapacity <= 0) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!cleanName) {
      setMessage("Enter the late player's name.");
      return;
    }
    if (!selectedMatchId) {
      setMessage("No unlocked BYE slot is available.");
      return;
    }

    const error = onAdd(cleanName, selectedMatchId);
    if (error) {
      setMessage(error);
      return;
    }

    setName("");
    setMessage(`${cleanName} was added and the BYE was replaced.`);
  }

  return (
    <section className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.08] via-slate-950/95 to-slate-950/95 p-5 shadow-2xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
            Late entry
          </span>
          <h3 className="mt-2 text-xl font-black text-white">
            Replace an unused first-round BYE
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            A late player can join while the BYE recipient&apos;s next affected
            match has not started and has no saved score. Existing played
            matches stay unchanged.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">
          {availableSlots.length} open BYE slot
          {availableSlots.length === 1 ? "" : "s"}
        </span>
      </div>

      {availableSlots.length > 0 ? (
        <form
          onSubmit={submit}
          className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto]"
        >
          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Player name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter late player"
              autoComplete="off"
              className="h-12 min-w-0 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold normal-case tracking-normal text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            BYE to replace
            <select
              value={selectedMatchId}
              onChange={(event) => setSelectedMatchId(event.target.value)}
              className="h-12 min-w-0 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10"
            >
              {availableSlots.map((slot) => (
                <option key={slot.matchId} value={slot.matchId}>
                  {slot.advancingPlayer}&apos;s BYE · {slot.roundName} · Match {slot.matchNumber}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="min-h-12 self-end rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-300/10 hover:bg-amber-200"
          >
            Add late player
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
          Every remaining BYE is locked because an affected match has already
          started or has a saved result.
        </div>
      )}

      {lockedSlots.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-300">
            {lockedSlots.length} locked BYE slot
            {lockedSlots.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-3 grid gap-2">
            {lockedSlots.map((slot) => (
              <p key={slot.matchId} className="text-xs leading-5 text-slate-500">
                <strong className="text-slate-300">
                  {slot.advancingPlayer} · Match {slot.matchNumber}:
                </strong>{" "}
                {slot.lockedReason}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {message ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-sm font-bold text-amber-100"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
