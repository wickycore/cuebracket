"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { NotificationBell } from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/client";

export function SpectatorAuthNav({ returnTo }: { returnTo: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setReady(true);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!ready) {
    return <span aria-hidden="true" className="h-10 w-28 animate-pulse rounded-xl bg-[#11335d] ring-1 ring-[#356a98]" />;
  }

  if (!user) {
    const next = encodeURIComponent(returnTo);
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <a
          data-cb-hard-navigation="true"
          href={`/auth/login?next=${next}`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2a5680] px-3 text-xs font-black text-[#dce8f4] transition hover:border-[#27c2e6] hover:text-[#fafcff] sm:px-4 sm:text-sm"
        >
          Sign in
        </a>
        <a
          data-cb-hard-navigation="true"
          href={`/auth/signup?next=${next}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#27c2e6] px-3 text-xs font-black text-[#071a35] transition hover:bg-[#52d3ee] sm:px-4 sm:text-sm"
        >
          Sign up
        </a>
      </div>
    );
  }

  const label = user.user_metadata?.display_name || user.email || "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <a
        data-cb-hard-navigation="true"
        href="/account"
        title={label}
        aria-label="Open player account"
        className="grid h-10 w-10 place-items-center rounded-xl border border-[#27c2e6]/40 bg-[#27c2e6]/12 text-sm font-black text-[#c8f3fb] transition hover:border-[#52d3ee]/70 hover:bg-[#27c2e6]/18"
      >
        {initial}
      </a>
    </div>
  );
}
