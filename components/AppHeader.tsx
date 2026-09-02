"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AuthNav } from "@/components/AuthNav";
import { NotificationBell } from "@/components/NotificationBell";

const publicNavigation = [
  { href: "/events", label: "Discover" },
  { href: "/clubs", label: "Clubs" },
  { href: "/rankings", label: "Rankings" },
  { href: "/hall-of-champions", label: "Champions" },
];

const organizerNavigation = [
  { href: "/dashboard", label: "My dashboard" },
  { href: "/tournaments", label: "My tournaments" },
  { href: "/leagues", label: "My leagues" },
  { href: "/following", label: "Followed players" },
  { href: "/tables", label: "My tables" },
  { href: "/cloud", label: "Cloud backup" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ href, label, pathname, onClick, mobile = false }: {
  href: string;
  label: string;
  pathname: string;
  onClick?: () => void;
  mobile?: boolean;
}) {
  const active = isActivePath(pathname, href);
  return (
    <a
      data-cb-hard-navigation="true"
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={mobile
        ? `flex min-h-12 items-center justify-between rounded-2xl px-4 py-3.5 text-base font-bold transition ${active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20" : "bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]"}`
        : `block rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`}
    >
      <span>{label}</span>
      {mobile ? <span aria-hidden="true" className="text-xl text-slate-400">›</span> : null}
    </a>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu(restoreFocus = true) {
    setMenuOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="no-print sticky top-0 z-[120] border-b border-white/10 bg-[#020617]/95 backdrop-blur-xl">
        <div className="cb-safe-top">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-[4.5rem] sm:px-6 lg:px-8">
            <a data-cb-hard-navigation="true" href="/" className="flex min-w-0 items-center gap-2.5 rounded-xl pr-2 font-black text-white" aria-label="CueBracket Pro home">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">8</span>
              <span className="truncate text-sm sm:text-base">CueBracket Pro</span>
            </a>

            <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
              {publicNavigation.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} />)}
              <details className="group relative">
                <summary className={`cursor-pointer list-none rounded-xl px-3 py-2.5 text-sm font-bold transition [&::-webkit-details-marker]:hidden ${organizerNavigation.some((item) => isActivePath(pathname, item.href)) ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`}>
                  Manage <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-180">⌄</span>
                </summary>
                <div className="absolute right-0 top-[calc(100%+.65rem)] w-64 rounded-2xl border border-white/10 bg-[#07101f] p-2 shadow-2xl shadow-black/60">
                  <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Organizer workspace</p>
                  {organizerNavigation.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} />)}
                </div>
              </details>
              <a data-cb-hard-navigation="true" href="/tournaments/new" className="ml-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300">+ New event</a>
              <div className="ml-2"><NotificationBell /></div>
              <div className="ml-2"><AuthNav /></div>
            </nav>

            <div className="flex items-center gap-2 xl:hidden">
              <NotificationBell />
              <div className="hidden min-[360px]:block"><AuthNav compact /></div>
              <a data-cb-hard-navigation="true" href="/tournaments/new" aria-label="Create new tournament" className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950 shadow-lg shadow-cyan-500/15 active:scale-95">+</a>
              <button ref={menuButtonRef} type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white transition active:scale-95">
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm transition-opacity duration-200 xl:hidden ${menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => closeMenu()} aria-hidden="true" />
      <aside ref={drawerRef} id="mobile-navigation" aria-hidden={!menuOpen} inert={!menuOpen} className={`fixed right-0 top-0 z-[130] flex h-dvh w-[min(88vw,22rem)] flex-col border-l border-white/10 bg-[#020817] shadow-2xl shadow-black/70 transition-transform duration-200 xl:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="cb-safe-top flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">CueBracket menu</p><p className="mt-1 text-lg font-black text-white">Play, follow and manage</p></div>
          <button ref={closeButtonRef} type="button" aria-label="Close navigation menu" onClick={() => closeMenu()} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white"><svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <a data-cb-hard-navigation="true" href="/tournaments/new" onClick={() => closeMenu(false)} className="mb-5 flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950">+ Create new event</a>
          <p className="mb-2 px-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Explore CueBracket</p>
          <nav aria-label="Public pages" className="space-y-2">{publicNavigation.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} mobile onClick={() => closeMenu(false)} />)}</nav>
          <p className="mb-2 mt-6 px-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Your organizer tools</p>
          <nav aria-label="Organizer pages" className="space-y-2">{organizerNavigation.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} mobile onClick={() => closeMenu(false)} />)}</nav>
          <p className="mt-4 px-2 text-xs leading-5 text-slate-400">Organizer tools ask you to sign in when your account is not active.</p>
        </div>
        <div className="cb-safe-bottom border-t border-white/10 p-4"><AuthNav /></div>
      </aside>
    </>
  );
}
