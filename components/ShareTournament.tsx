"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getMyCloudTournament,
  setCloudTournamentVisibility,
  syncTournamentToCloud,
} from "@/lib/cloud/tournaments";
import type { Tournament } from "@/lib/tournaments";

function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function ShareTournament({
  tournament,
}: {
  tournament: Tournament;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"loading" | "signed_out" | "private" | "public" | "working" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getMyCloudTournament(tournament.id)
      .then((row) => {
        if (!active) return;
        setOrigin(publicOrigin());
        setState(row?.is_public ? "public" : "private");
      })
      .catch((error) => {
        if (!active) return;
        setOrigin(publicOrigin());
        const text = error instanceof Error ? error.message : "Unable to check cloud status.";
        setMessage(text);
        setState(text.toLowerCase().includes("sign in") ? "signed_out" : "error");
      });
    return () => {
      active = false;
    };
  }, [tournament.id]);

  const liveUrl = useMemo(
    () => (origin ? `${origin}/cloud/live/${tournament.id}` : ""),
    [origin, tournament.id],
  );
  const encodedUrl = encodeURIComponent(liveUrl);
  const encodedText = encodeURIComponent(
    `Follow ${tournament.name} live on CueBracket Pro`,
  );
  const qrUrl = liveUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodedUrl}`
    : "";

  async function copyLink() {
    if (!liveUrl || state !== "public") return;
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function publish() {
    setState("working");
    setMessage("");
    try {
      await syncTournamentToCloud(tournament);
      await setCloudTournamentVisibility(tournament.id, true);
      setState("public");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to publish this tournament.";
      setMessage(text);
      setState(text.toLowerCase().includes("sign in") ? "signed_out" : "error");
    }
  }

  async function unpublish() {
    if (!window.confirm("Make this spectator link private? Anyone using it will lose access.")) return;
    setState("working");
    try {
      await setCloudTournamentVisibility(tournament.id, false);
      setState("private");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change visibility.");
      setState("error");
    }
  }

  const isPublic = state === "public";

  return (
    <section className="mt-4 rounded-2xl bg-slate-950/35 p-4 sm:p-5">
      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">
            Share tournament
          </p>
          <h2 className="mt-2 text-2xl font-black">Public cloud live view</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Publish once, then the link and QR code open the live spectator page
            on every device. Private and local-only tournaments never expose a
            link that spectators cannot open.
          </p>

          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${isPublic ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
            {state === "loading" ? "Checking cloud publication…" : state === "working" ? "Updating cloud publication…" : isPublic ? "Public and ready to share" : state === "signed_out" ? "Sign in to publish this tournament." : state === "error" ? message : "Private — publish when you are ready to share."}
          </div>

          {!isPublic ? (
            <button type="button" onClick={publish} disabled={state === "loading" || state === "working" || state === "signed_out"} className="mt-4 rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              {state === "working" ? "Publishing…" : "Publish live view"}
            </button>
          ) : null}

          {isPublic ? <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={isPublic ? liveUrl : ""}
              aria-label="Public tournament link"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={!liveUrl || !isPublic}
              className="min-h-12 rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy cloud link"}
            </button>
          </div> : null}

          {isPublic ? <div className="mt-4 flex flex-wrap gap-2">
            <a data-cb-hard-navigation="true" href={liveUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">Open public view ↗</a>
            <a
              href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/20"
            >
              WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-blue-400/10 px-4 py-2 text-sm font-bold text-blue-300 ring-1 ring-blue-400/20"
            >
              Facebook
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 ring-1 ring-white/10"
            >
              X / Twitter
            </a>
            <Link
              href="/cloud"
              className="rounded-xl bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-200 ring-1 ring-amber-300/20"
            >
              Check cloud status
            </Link>
            <button type="button" onClick={unpublish} className="rounded-xl bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-200 ring-1 ring-rose-400/20">Make private</button>
          </div> : state === "signed_out" ? <Link href={`/auth/login?next=${encodeURIComponent(`/tournaments/${tournament.id}`)}`} className="mt-4 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-black text-cyan-200">Sign in to publish</Link> : null}
        </div>

        {qrUrl && isPublic ? (
          <div className="mx-auto rounded-3xl bg-white p-3 shadow-2xl shadow-cyan-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR code for ${tournament.name}`}
              className="h-52 w-52 sm:h-56 sm:w-56"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
