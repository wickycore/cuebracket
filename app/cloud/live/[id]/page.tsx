import type { Metadata } from "next";
import Link from "next/link";
import { RealtimeCloudTournament } from "@/components/RealtimeCloudTournament";
import { SpectatorAuthNav } from "@/components/SpectatorAuthNav";
import { getPublicTournamentSnapshot } from "@/lib/cloud/public-tournaments.server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await getPublicTournamentSnapshot(id);
  const row = snapshot.row;
  const title = row ? `${row.name} · ${row.status === "live" ? "Live scores" : "Tournament results"}` : "Tournament spectator view";
  const description = row
    ? `${row.venue || "CueBracket tournament"} · ${row.format.replaceAll("_", " ")} · Race to ${row.race_to}. Follow the bracket, scores and results.`
    : "Follow public pool tournament brackets, scores and results on CueBracket.";
  const path = `/cloud/live/${id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: "CueBracket Pro",
      title,
      description,
      ...(row?.poster_url ? { images: [{ url: row.poster_url, alt: `${row.name} tournament poster` }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(row?.poster_url ? { images: [row.poster_url] } : {}),
    },
  };
}

export default async function CloudLivePage({
  params,
}: Props) {
  const { id } = await params;
  const snapshot = await getPublicTournamentSnapshot(id);

  return (
    <main className="min-h-screen bg-[#071a35] text-[#fafcff]">
      <header className="sticky top-0 z-[140] border-b border-[#2a5680] bg-[#0d2a50]/95 backdrop-blur-xl">
        <div className="cb-safe-top mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href="/" className="min-w-0 shrink truncate text-sm font-black text-[#52d3ee] sm:text-base">
            🎱 CueBracket Live
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-xs font-black uppercase tracking-wider text-[#9fb4ca] md:inline">
              Cloud spectator mode
            </span>
            <SpectatorAuthNav returnTo={`/cloud/live/${id}`} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-10">
        <RealtimeCloudTournament
          id={id}
          initialRow={snapshot.row}
          initialState={snapshot.state}
        />
      </div>
    </main>
  );
}
