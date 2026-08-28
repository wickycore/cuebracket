import Link from "next/link";
import { RealtimeCloudTournament } from "@/components/RealtimeCloudTournament";
import { SpectatorAuthNav } from "@/components/SpectatorAuthNav";

export default async function CloudLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#071a35] text-[#fafcff]">
      <header className="sticky top-0 z-[140] border-b border-[#2a5680] bg-[#0d2a50]/95 backdrop-blur-xl">
        <div className="cb-safe-top mx-auto flex min-h-12 max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-5 sm:py-3">
          <Link href="/" className="min-w-0 shrink truncate text-[0.68rem] font-black text-[#52d3ee] sm:text-base">
            🎱 CueBracket Live
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden text-xs font-black uppercase tracking-wider text-[#9fb4ca] md:inline">
              Cloud spectator mode
            </span>
            <SpectatorAuthNav returnTo={`/cloud/live/${id}`} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-10">
        <RealtimeCloudTournament id={id} />
      </div>
    </main>
  );
}
