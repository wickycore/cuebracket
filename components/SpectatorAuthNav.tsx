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
    return <span aria-hidden="true" className="h-10 w-28 animate-pulse rounded-xl bg-[#1b2b43] ring-1 ring-[#41536d]" />;
  }

  if (!user) {
    const next = encodeURIComponent(returnTo);
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <a
          data-cb-hard-navigation="true"
          href={`/auth/login?next=${next}`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#34465f] px-3 text-xs font-black text-[#d7dee7] transition hover:border-[#78b8d8] hover:text-[#f3f0e8] sm:px-4 sm:text-sm"
        >
          Sign in
        </a>
        <a
          data-cb-hard-navigation="true"
          href={`/auth/signup?next=${next}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#78b8d8] px-3 text-xs font-black text-[#0b1424] transition hover:bg-[#8ac3df] sm:px-4 sm:text-sm"
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
        className="grid h-10 w-10 place-items-center rounded-xl border border-[#78b8d8]/35 bg-[#78b8d8]/10 text-sm font-black text-[#b8ddeb] transition hover:border-[#8ac3df]/60 hover:bg-[#78b8d8]/15"
      >
        {initial}
      </a>
    </div>
  );
}
