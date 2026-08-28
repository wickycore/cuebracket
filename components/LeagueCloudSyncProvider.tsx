"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { deleteCloudLeague, getMyCloudLeagues, rowToLeague, syncLeagueToCloud } from "@/lib/cloud/leagues";
import { createClient } from "@/lib/supabase/client";
import { getLeagues, saveLeagues, subscribeToLeagueChanges, type League } from "@/lib/leagues";
import { getLocalCloudOwner, removeLocalCloudOwner, setLocalCloudOwner } from "@/lib/cloud/local-ownership";

function fingerprint(league: League) {
  return JSON.stringify(league, (key, value) => key === "updatedAt" ? undefined : value);
}

export function LeagueCloudSyncProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let applyingCloud = false;
    let userId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observed = new Map<string, string>();
    const managedIds = new Set<string>();

    const remember = (leagues = getLeagues()) => {
      observed.clear();
      leagues.forEach((league) => observed.set(league.id, fingerprint(league)));
    };

    const reconcile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      userId = user?.id ?? null;
      if (!user) { remember(); return; }
      try {
        const rows = await getMyCloudLeagues();
        if (!active || userId !== user.id) return;
        const cloudById = new Map(rows.map((row) => [row.id, row]));
        managedIds.clear();
        rows.forEach((row) => { managedIds.add(row.id); setLocalCloudOwner(row.id, row.owner_id); });
        let local = getLeagues();
        for (const row of rows) {
          const incoming = rowToLeague(row);
          const existing = local.find((league) => league.id === incoming.id);
          if (!existing || Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt)) {
            local = [incoming, ...local.filter((league) => league.id !== incoming.id)];
          }
        }
        applyingCloud = true;
        saveLeagues(local);
        applyingCloud = false;
        remember(local);
        await Promise.all(local.filter((league) => {
          const row = cloudById.get(league.id);
          return !row || Date.parse(league.updatedAt) > Date.parse(row.updated_at);
        }).filter((league) => {
          const owner = getLocalCloudOwner(league.id);
          return !owner || owner === user.id || managedIds.has(league.id);
        }).map(async (league) => {
          const row = await syncLeagueToCloud(league);
          setLocalCloudOwner(league.id, row.owner_id);
        }));
      } catch {
        remember();
      }
    };

    const flush = async () => {
      timer = null;
      if (!active || !userId || applyingCloud) return;
      const current = getLeagues();
      const currentById = new Map(current.map((league) => [league.id, league]));
      const tasks: Promise<unknown>[] = [];
      current.forEach((league) => {
        const owner = getLocalCloudOwner(league.id);
        if (observed.get(league.id) !== fingerprint(league) && (!owner || owner === userId || managedIds.has(league.id))) {
          tasks.push(syncLeagueToCloud(league).then((row) => setLocalCloudOwner(league.id, row.owner_id)));
        }
      });
      observed.forEach((_value, id) => {
        const owner = getLocalCloudOwner(id);
        if (!currentById.has(id) && (owner === userId || managedIds.has(id))) {
          tasks.push(deleteCloudLeague(id).then(() => removeLocalCloudOwner(id)));
        }
      });
      remember(current);
      await Promise.allSettled(tasks);
    };

    const unsubscribe = subscribeToLeagueChanges(() => {
      if (applyingCloud || !userId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 180);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userId = session?.user.id ?? null;
      managedIds.clear();
      setTimeout(() => { if (active) void reconcile(); }, 0);
    });
    const onFocus = () => void reconcile();
    window.addEventListener("focus", onFocus);
    remember();
    void reconcile();
    return () => {
      active = false;
      unsubscribe();
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return children;
}
