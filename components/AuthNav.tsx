"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="rounded-lg border border-cyan-400/30 px-3 py-2 text-cyan-300"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5"
      >
        Account
      </Link>
      <button
        onClick={signOut}
        className="rounded-lg border border-white/10 px-3 py-2 text-slate-300"
      >
        Sign out
      </button>
    </div>
  );
}
