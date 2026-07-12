"use client";

import Link from "next/link";
import { PrintTournamentButton } from "@/components/PrintTournamentButton";

export function TournamentActionBar({ tournamentId }: { tournamentId: string }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Link
        href={`/display/${tournamentId}`}
        target="_blank"
        className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-black text-violet-300"
      >
        📺 TV Mode
      </Link>
      <PrintTournamentButton />
    </div>
  );
}
