"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearBrowserPush, PUSH_OWNER_KEY } from "@/lib/push";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const PwaContext = createContext({ ready: false, installed: false, ios: false, canInstall: false, install: async () => {} });
export function usePwa() { return useContext(PwaContext); }

export function PwaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      setReady(true);
    };
    const timer = window.setTimeout(sync, 0);
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const didInstall = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    display.addEventListener("change", sync);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => { /* Installation controls remain usable; push setup reports its own error. */ });
    }
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", didInstall); display.removeEventListener("change", sync); };
  }, []);
  useEffect(() => {
    const supabase = createClient();
    const timers = new Set<number>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        try {
          const owner = localStorage.getItem(PUSH_OWNER_KEY);
          if (owner && (event === "SIGNED_OUT" || (session && owner !== session.user.id) || (event === "INITIAL_SESSION" && !session))) {
            void clearBrowserPush().catch(() => {});
          }
        } catch { /* Storage restrictions do not prevent normal site use. */ }
      }, 0);
      timers.add(timer);
    });
    return () => { subscription.unsubscribe(); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, []);
  async function install() {
    if (!prompt) return;
    try { await prompt.prompt(); await prompt.userChoice; }
    finally { setPrompt(null); }
  }
  return <PwaContext.Provider value={{ ready, installed, ios, canInstall: Boolean(prompt), install }}>{children}</PwaContext.Provider>;
}
