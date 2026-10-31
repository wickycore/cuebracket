"use client";

import { useState } from "react";

export function ShareLeague({ id, name }: { id: string; name: string }) {
  const [message, setMessage] = useState("");

  async function share() {
    setMessage("");
    const url = new URL(`/league/${id}`, window.location.origin);
    // Give messaging apps a fresh URL after the league preview update.
    url.searchParams.set("preview", "league-v2");
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Follow ${name} fixtures, scores and standings.`, url: url.toString() });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setMessage("Public league link copied.");
    } catch {
      setMessage("Open public view and copy its address to share the league.");
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void share()} className="rounded-xl border border-cyan-400/30 px-4 py-3 text-sm font-bold text-cyan-200">Share league</button>
      {message ? <p role="status" className="mt-2 max-w-xs text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
