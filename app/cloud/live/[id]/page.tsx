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
    <main className="min-h-screen bg-[#0b1424] text-[#f3f0e8]">
      <header className="sticky top-0 z-[140] border-b border-[#34465f] bg-[#111d30]/95 backdrop-blur-xl">
        <div className="cb-safe-top mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href="/" className="min-w-0 shrink truncate text-sm font-black text-[#8ac3df] sm:text-base">
            🎱 CueBracket Live
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-xs font-black uppercase tracking-wider text-[#8292a8] md:inline">
              Cloud spectator mode
            </span>
            <SpectatorAuthNav returnTo={`/cloud/live/${id}`} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-10">
        <RealtimeCloudTournament id={id} />
      </div>
    </main>
  );
}
