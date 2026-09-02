import type { Metadata } from "next";

export const metadata: Metadata = { title: "League control room", description: "Manage pool league players, fixtures, standings and playoffs." };

export default function LeagueControlLayout({ children }: { children: React.ReactNode }) { return children; }
