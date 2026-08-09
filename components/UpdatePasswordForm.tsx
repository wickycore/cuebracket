"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("error") ?? "");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setMessage("");
    setSuccess(false);

    if (password.length < 6) {
      setMessage("Use at least 6 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage(
          "This reset link is invalid or has expired. Request a new password reset link.",
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccess(true);
      setMessage("Password updated successfully. Taking you back to your dashboard.");

      router.replace("/dashboard");
      router.refresh();
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
      <label className="block text-sm font-bold text-slate-300">
        New password
        <input
          type="password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
          className={inputClass}
        />
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          Use at least 6 characters.
        </span>
      </label>

      <label className="block text-sm font-bold text-slate-300">
        Confirm new password
        <input
          type="password"
          minLength={6}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
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
        {busy ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
