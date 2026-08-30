"use client";

import Link from "next/link";
import { useState } from "react";
import { usePwa } from "@/components/PwaProvider";

export function PwaInstallCard() {
  const { ready, installed, ios, canInstall, install } = usePwa();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  async function handleInstall() {
    setBusy(true); setError("");
    try { await install(); } catch { setError("Installation could not open. Use your browser’s Install app or Add to Home Screen menu."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-5 sm:p-6" aria-labelledby="install-app-title">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="cb-kicker">CueBracket on your phone</p><h2 id="install-app-title" className="mt-2 text-xl font-black">{installed ? "You're using the CueBracket app" : "One tap from your next game"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{installed ? "Manage match alerts from your notification settings." : "Add CueBracket to your home screen, then choose whether to enable phone alerts."}</p></div>
      {installed ? <Link href="/notifications#phone-alerts" className="inline-flex min-h-12 items-center rounded-xl border border-cyan-300/25 px-4 text-sm font-black text-cyan-200">Notification settings →</Link> : canInstall ? <button type="button" disabled={busy} onClick={() => void handleInstall()} className="min-h-12 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Opening…" : "Install CueBracket"}</button> : null}
    </div>
    {!installed && !canInstall ? <details className="mt-4 text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-2 font-bold text-cyan-200">How to add CueBracket</summary><p className="mt-2 leading-6">{ios ? "On iPhone or iPad, open CueBracket in Safari, tap Share, then Add to Home Screen. Open the installed app before enabling phone alerts (iOS/iPadOS 16.4 or newer)." : "Open your browser menu and choose Install app or Add to Home Screen. If neither is available, try Chrome, Edge or Safari on a supported device. You can always keep using the website."}</p></details> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p> : null}
  </section>;
}
