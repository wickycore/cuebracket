"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthNav } from "@/components/AuthNav";

const navigation = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { href: "/tournaments", label: "Tournaments", shortLabel: "Events" },
  { href: "/leagues", label: "Leagues", shortLabel: "Leagues" },
  { href: "/tables", label: "Tables", shortLabel: "Tables" },
  { href: "/hall-of-champions", label: "Champions", shortLabel: "Winners" },
  { href: "/cloud", label: "Cloud", shortLabel: "Cloud" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="no-print sticky top-0 z-[120] border-b border-white/10 bg-[#020617]/95 backdrop-blur-xl">
        <div className="cb-safe-top">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-[4.5rem] sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2.5 rounded-xl pr-2 font-black text-white"
              aria-label="CueBracket Pro home"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">
                8
              </span>
              <span className="truncate text-sm sm:text-base">
                CueBracket Pro
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link
                href="/tournaments/new"
                className="ml-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                + New event
              </Link>

              <div className="ml-2">
                <AuthNav />
              </div>
            </nav>

            <div className="flex items-center gap-2 lg:hidden">
              <div className="hidden min-[360px]:block">
                <AuthNav compact />
              </div>

              <Link
                href="/tournaments/new"
                aria-label="Create new tournament"
                className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950 shadow-lg shadow-cyan-500/15 active:scale-95"
              >
                +
              </Link>

              <button
                type="button"
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMenuOpen((open) => !open)}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white transition active:scale-95"
              >
                {menuOpen ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                    <path
                      d="M4 7h16M4 12h16M4 17h16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="mobile-navigation"
        aria-hidden={!menuOpen}
        className={`fixed right-0 top-0 z-[130] flex h-dvh w-[min(88vw,22rem)] flex-col border-l border-white/10 bg-[#020817] shadow-2xl shadow-black/70 transition-transform duration-200 lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="cb-safe-top flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-cyan-300">
              Organizer menu
            </p>
            <p className="mt-1 text-lg font-black text-white">CueBracket Pro</p>
          </div>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <Link
            href="/tournaments/new"
            className="mb-5 flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950"
          >
            + Create new event
          </Link>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-12 items-center justify-between rounded-2xl px-4 py-3.5 text-base font-bold transition ${
                    active
                      ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20"
                      : "bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]"
                  }`}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-xl text-slate-500">
                    ›
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="cb-safe-bottom border-t border-white/10 p-4">
          <AuthNav />
        </div>
      </aside>
    </>
  );
}
