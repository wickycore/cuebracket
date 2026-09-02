import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tournament display", description: "CueBracket venue display for live matches, tables and scores." };

export default function TournamentDisplayLayout({ children }: { children: React.ReactNode }) { return children; }
