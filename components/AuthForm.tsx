"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function callbackUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const origin =
    process.env.NODE_ENV === "production" && configured
      ? configured
      : window.location.origin;

  return `${origin}/auth/callback?next=/dashboard`;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("error") ?? "");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callbackUrl(),
            data: {
              display_name: displayName.trim() || email.split("@")[0],
            },
          },
        });

        if (error) {
          setMessage(error.message);
        } else {
          setSuccess(true);
          setMessage("Account created. Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setMessage(error.message);
        } else {
          router.push(searchParams.get("next") ?? "/dashboard");
          router.refresh();
        }
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10";

  return (
    <form
      onSubmit={submit}
      className="mt-7 space-y-5 rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6"
    >
      {mode === "signup" ? (
        <label className="block text-sm font-bold text-slate-300">
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            autoComplete="name"
            className={inputClass}
          />
        </label>
      ) : null}

      <label className="block text-sm font-bold text-slate-300">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          inputMode="email"
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-bold text-slate-300">
        Password
        <input
          type="password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />
        {mode === "signup" ? (
          <span className="mt-2 block text-xs leading-5 text-slate-500">
            Use at least 6 characters.
          </span>
        ) : null}
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
        {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
