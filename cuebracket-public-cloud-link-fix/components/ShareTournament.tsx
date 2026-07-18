"use client";

import { useEffect, useMemo, useState } from "react";

export function ShareTournament({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const liveUrl = useMemo(
    () => (origin ? `${origin}/cloud/live/${tournamentId}` : ""),
    [origin, tournamentId],
  );

  const encodedUrl = encodeURIComponent(liveUrl);
  const encodedText = encodeURIComponent(
    `Follow ${tournamentName} live on CueBracket Pro`,
  );
  const qrUrl = liveUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodedUrl}`
    : "";

  async function copyLink() {
    if (!liveUrl) return;

    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">
            Share tournament
          </p>
          <h2 className="mt-2 text-2xl font-black">Public live view</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Share the spectator link or QR code. Cloud-published tournaments
            update spectators in realtime across phones, laptops and TV screens.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={liveUrl}
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
            />
            <button
              onClick={copyLink}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
          </div>
        </div>

        {qrUrl ? (
          <div className="rounded-3xl bg-white p-3 shadow-2xl shadow-cyan-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Tournament QR code"
              className="h-40 w-40 sm:h-48 sm:w-48"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
