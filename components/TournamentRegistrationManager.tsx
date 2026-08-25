"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import {
  changeRegistrationStatus,
  getOrganizerRegistrations,
  getRegistrationSettings,
  removeRegistration,
  saveRegistrationSettings,
  type EventRegistrationRow,
  type RegistrationSettingsRow,
} from "@/lib/cloud/registrations";
import { mergeCheckedInPlayers, type RegistrationStatus } from "@/lib/registration";
import { createClient } from "@/lib/supabase/client";
import { updateTournament, type Tournament } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}

function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const statusStyles: Record<RegistrationStatus, string> = {
  pending: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
  approved: "bg-cyan-300/10 text-cyan-200 ring-cyan-300/20",
  waitlisted: "bg-violet-300/10 text-violet-200 ring-violet-300/20",
  checked_in: "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20",
  withdrawn: "bg-slate-300/10 text-slate-300 ring-slate-300/20",
  rejected: "bg-rose-300/10 text-rose-200 ring-rose-300/20",
};

export function TournamentRegistrationManager({ tournament, onTournamentChange }: Props) {
  const [settings, setSettings] = useState<RegistrationSettingsRow | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistrationRow[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "signed_out" | "working" | "error">("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busyId, setBusyId] = useState("");
  const [origin] = useState(() => publicOrigin());

  const registrationUrl = origin ? `${origin}/register/${tournament.id}` : "";

  const loadRegistrations = useCallback(async () => {
    const rows = await getOrganizerRegistrations(tournament.id);
    setRegistrations(rows);
  }, [tournament.id]);

  useEffect(() => {
    let active = true;
    Promise.all([getRegistrationSettings(tournament.id), getOrganizerRegistrations(tournament.id)])
      .then(([currentSettings, rows]) => {
        if (!active) return;
        setSettings(currentSettings);
        setRegistrations(rows);
        setScheduledAt(inputDate(currentSettings?.scheduled_at ?? null));
        setEntryFee(currentSettings?.entry_fee ?? "");
        setNotes(currentSettings?.notes ?? "");
        setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        const text = error instanceof Error ? error.message : "Unable to load registration.";
        setMessage(text);
        setState(text.toLowerCase().includes("sign in") ? "signed_out" : "error");
      });
    return () => {
      active = false;
    };
  }, [tournament.id]);

  useEffect(() => {
    if (state !== "ready" || !settings) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`event-registrations:${tournament.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_registrations", filter: `tournament_id=eq.${tournament.id}` },
        () => void loadRegistrations(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRegistrations, settings, state, tournament.id]);

  useEffect(() => {
    let active = true;
    if (!registrationUrl || !settings) return;
    QRCode.toDataURL(registrationUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#020617", light: "#ffffff" },
    }).then((value) => {
      if (active) setQrDataUrl(value);
    }).catch(() => {
      if (active) setQrDataUrl("");
    });
    return () => {
      active = false;
    };
  }, [registrationUrl, settings]);

  const counts = useMemo(() => ({
    pending: registrations.filter((item) => item.status === "pending").length,
    confirmed: registrations.filter((item) => item.status === "approved" || item.status === "checked_in").length,
    checkedIn: registrations.filter((item) => item.status === "checked_in").length,
    waitlisted: registrations.filter((item) => item.status === "waitlisted").length,
  }), [registrations]);

  async function save(open: boolean) {
    setState("working");
    setMessage("");
    try {
      const saved = await saveRegistrationSettings(tournament, {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        entryFee,
        notes,
        registrationOpen: open,
      });
      setSettings(saved);
      setState("ready");
      setMessage(open ? "Registration link is open and ready to share." : "Registration is closed. Existing entries are preserved.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to save registration.";
      setMessage(text);
      setState(text.toLowerCase().includes("sign in") ? "signed_out" : "error");
    }
  }

  async function changeStatus(item: EventRegistrationRow, status: RegistrationStatus) {
    setBusyId(item.id);
    setMessage("");
    try {
      const updated = await changeRegistrationStatus(item.id, status);
      setRegistrations((current) => current.map((row) => row.id === updated.id ? updated : row));
      if (status === "approved" && updated.status === "waitlisted") {
        setMessage(`${item.display_name} stayed on the waitlist because confirmed places are full.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this registration.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(item: EventRegistrationRow) {
    if (!window.confirm(`Remove ${item.display_name}'s registration?`)) return;
    setBusyId(item.id);
    try {
      await removeRegistration(item.id);
      setRegistrations((current) => current.filter((row) => row.id !== item.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this registration.");
    } finally {
      setBusyId("");
    }
  }

  function useCheckedInPlayers() {
    const names = registrations
      .filter((item) => item.status === "checked_in")
      .map((item) => item.display_name);
    const result = mergeCheckedInPlayers(tournament.players, names, tournament.bracketSize);
    const updated = updateTournament(tournament.id, { players: result.players });
    if (updated) onTournamentChange(updated);
    const details = [
      `${result.added} checked-in player${result.added === 1 ? "" : "s"} added`,
      result.duplicates ? `${result.duplicates} already listed` : "",
      result.overflow ? `${result.overflow} did not fit` : "",
    ].filter(Boolean);
    setMessage(details.join(" · "));
  }

  async function copyLink() {
    await navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const disabled = state === "loading" || state === "working";
  const visibleRows = registrations.filter((item) => item.status !== "withdrawn" && item.status !== "rejected");

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.09),transparent_34%),rgba(15,23,42,0.7)]">
      <div className="border-b border-white/10 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Player registration</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Fill the player list before the draw</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Share one link, approve entries and check players in. Guests can register without creating an account.
            </p>
          </div>
          {settings ? (
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ring-1 ${settings.registration_open ? "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20" : "bg-slate-300/10 text-slate-300 ring-slate-300/20"}`}>
              {settings.registration_open ? "Registration open" : "Registration closed"}
            </span>
          ) : null}
        </div>

        {state === "signed_out" ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
            Sign in to open online registration. You can still add walk-ins manually below.
            <a href={`/auth/login?next=${encodeURIComponent(`/tournaments/${tournament.id}`)}`} className="ml-2 underline">Sign in</a>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-slate-300">
              Event date and time <span className="text-slate-600">(optional)</span>
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:border-cyan-400/50" />
            </label>
            <label className="text-sm font-bold text-slate-300">
              Entry fee <span className="text-slate-600">(optional)</span>
              <input value={entryFee} maxLength={60} onChange={(event) => setEntryFee(event.target.value)} placeholder="e.g. KSh 500" className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50" />
            </label>
            <label className="text-sm font-bold text-slate-300 md:col-span-1">
              Player note <span className="text-slate-600">(optional)</span>
              <input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Arrival time, dress code…" className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50" />
            </label>
          </div>
        )}

        {message ? <p role="status" className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}

        {state !== "signed_out" ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={disabled} onClick={() => void save(settings?.registration_open ?? true)} className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-40">
              {state === "working" ? "Saving…" : settings ? "Save registration details" : "Open registration"}
            </button>
            {settings?.registration_open ? (
              <button type="button" disabled={disabled} onClick={() => void save(false)} className="rounded-2xl border border-rose-300/20 px-5 py-3 text-sm font-bold text-rose-200 hover:bg-rose-300/10 disabled:opacity-40">Close registration</button>
            ) : settings ? (
              <button type="button" disabled={disabled} onClick={() => void save(true)} className="rounded-2xl border border-emerald-300/20 px-5 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40">Reopen registration</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {settings && registrationUrl ? (
        <div className="grid gap-6 border-b border-white/10 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Registration link</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={registrationUrl} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-slate-300" />
              <button type="button" onClick={() => void copyLink()} className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950">{copied ? "Copied!" : "Copy link"}</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={registrationUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 ring-1 ring-white/10">Open page ↗</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Register for ${tournament.name}: ${registrationUrl}`)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20">WhatsApp</a>
            </div>
          </div>
          {qrDataUrl ? (
            <div className="mx-auto rounded-3xl bg-white p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`Registration QR for ${tournament.name}`} className="h-36 w-36" />
            </div>
          ) : null}
        </div>
      ) : null}

      {settings ? (
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Pending", counts.pending], ["Confirmed", counts.confirmed], ["Checked in", counts.checkedIn], ["Waitlist", counts.waitlisted]].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black">Registration desk</h3>
              <p className="mt-1 text-sm text-slate-500">Approve first, then check in players when they arrive.</p>
            </div>
            <button type="button" disabled={counts.checkedIn === 0} onClick={useCheckedInPlayers} className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">
              Use {counts.checkedIn} checked-in player{counts.checkedIn === 1 ? "" : "s"}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {visibleRows.length ? visibleRows.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black text-white">{item.display_name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider ring-1 ${statusStyles[item.status]}`}>{item.status.replace("_", " ")}</span>
                    {item.profile_id ? <span className="text-xs font-bold text-cyan-300">CueBracket player</span> : <span className="text-xs text-slate-600">Guest</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Registered {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status === "pending" ? <>
                    <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "approved")} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">Approve</button>
                    <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "waitlisted")} className="rounded-xl bg-violet-300/10 px-3 py-2 text-xs font-bold text-violet-200 ring-1 ring-violet-300/20">Waitlist</button>
                    <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "rejected")} className="rounded-xl bg-rose-300/10 px-3 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-300/20">Reject</button>
                  </> : null}
                  {item.status === "approved" ? <>
                    <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "checked_in")} className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950">Check in</button>
                    <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "waitlisted")} className="rounded-xl bg-violet-300/10 px-3 py-2 text-xs font-bold text-violet-200 ring-1 ring-violet-300/20">Waitlist</button>
                  </> : null}
                  {item.status === "waitlisted" ? <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "approved")} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">Approve if space</button> : null}
                  {item.status === "checked_in" ? <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "approved")} className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10">Undo check-in</button> : null}
                  <button disabled={busyId === item.id} onClick={() => void remove(item)} aria-label={`Remove ${item.display_name}`} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-rose-300/10 hover:text-rose-200">Remove</button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">No online registrations yet. Share the link or add walk-ins manually below.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
