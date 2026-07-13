"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthNav } from "@/components/AuthNav";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/leagues", label: "Leagues" },
  { href: "/tables", label: "Tables" },
  { href: "/hall-of-champions", label: "Champions" },
  { href: "/cloud", label: "Cloud" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-slate-950/82 shadow-2xl shadow-black/10 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-5">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3 font-black tracking-tight text-white"
          onClick={() => setMenuOpen(false)}
        >
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-cyan-400 text-base text-slate-950 shadow-lg shadow-cyan-400/20 transition group-hover:rotate-3 group-hover:scale-105">
            <span className="absolute inset-1 rounded-full border-2 border-slate-950/35" />
            <span className="relative">8</span>
          </span>
          <span className="hidden text-lg sm:inline">
            CueBracket <span className="text-cyan-300">Pro</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-xl px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-cyan-400/10 text-cyan-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-[1.14rem] h-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/tournaments/new"
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-cyan-400/10 transition hover:bg-cyan-300"
          >
            + New event
          </Link>
          <AuthNav />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <AuthNav compact />
          <Link
            href="/tournaments/new"
            aria-label="Create tournament"
            className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950"
          >
            +
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg text-white"
          >
            {menuOpen ? "×" : "≡"}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-white/10 bg-slate-950/96 px-4 py-4 lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 sm:grid-cols-3">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    active
                      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.035] text-slate-300"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
