"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

function resetRedirectUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const origin =
    process.env.NODE_ENV === "production" && configured
      ? configured
      : window.location.origin;

  return `${origin}/auth/callback?next=/auth/update-password`;
}

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetRedirectUrl(),
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccess(true);
      setMessage(
        "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.",
      );
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

  return (
    <form
      onSubmit={submit}
      className="mt-7 space-y-5 rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6"
    >
      <label className="block text-sm font-bold text-slate-300">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </label>

      {message ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${
            success
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-rose-400/20 bg-rose-400/10 text-rose-200"
          }`}
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Sending reset link..." : "Send reset link"}
      </button>
    </form>
  );
}
