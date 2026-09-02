import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live tournament", description: "Follow a CueBracket tournament bracket and live scores in real time." };

export default function LiveTournamentLayout({ children }: { children: React.ReactNode }) { return children; }
