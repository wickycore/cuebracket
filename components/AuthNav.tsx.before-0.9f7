"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface AuthNavProps {
  compact?: boolean;
}

export function AuthNav({ compact = false }: AuthNavProps) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!active) return;

      setUser(data.user);
      setReady(true);
    }

    void loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;

        setUser(session?.user ?? null);
        setReady(true);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!ready) {
    return (
      <span
        aria-hidden="true"
        className={`${compact ? "h-9 w-9 rounded-xl" : "h-9 w-20 rounded-xl"} animate-pulse bg-white/5 ring-1 ring-white/10`}
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className={`inline-flex items-center justify-center border border-cyan-400/25 bg-cyan-400/[0.06] font-black text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/10 ${
          compact ? "h-9 rounded-xl px-3 text-xs" : "rounded-xl px-4 py-2 text-sm"
        }`}
      >
        Sign in
      </Link>
    );
  }

  const label = user.user_metadata?.display_name || user.email || "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "C";

  if (compact) {
    return (
      <Link
        href="/account"
        title={label}
        aria-label="Open account"
        className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-black text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
      >
        {initial}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/10 text-xs font-black text-cyan-200 ring-1 ring-cyan-400/20">
          {initial}
        </span>
        <span className="hidden xl:inline">Account</span>
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-400 transition hover:border-rose-400/25 hover:bg-rose-400/[0.06] hover:text-rose-200"
      >
        Sign out
      </button>
    </div>
  );
}
