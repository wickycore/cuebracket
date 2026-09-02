import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tournament control room", description: "Manage players, scores, brackets and live tournament operations." };

export default function TournamentControlLayout({ children }: { children: React.ReactNode }) { return children; }
