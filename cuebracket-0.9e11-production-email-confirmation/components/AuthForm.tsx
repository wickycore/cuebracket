"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function getAuthCallbackUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/+$/, "");

  const origin =
    process.env.NODE_ENV === "production" && configuredSiteUrl
      ? configuredSiteUrl
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: {
              display_name: displayName.trim() || email.split("@")[0],
            },
          },
        });

        if (error) {
          setMessage(error.message);
        } else {
          setMessage(
            "Account created. Check your email to confirm your account.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
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

  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-4 rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-2xl shadow-black/30"
    >
      {mode === "signup" ? (
        <label className="block text-sm font-bold text-slate-300">
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/50"
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
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/50"
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
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/50"
        />
      </label>

      {message ? (
        <p className="rounded-xl bg-cyan-400/10 p-3 text-sm font-bold text-cyan-200">
          {message}
        </p>
      ) : null}

      <button
        disabled={busy}
        className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50"
      >
        {busy
          ? "Please wait..."
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>
    </form>
  );
}
