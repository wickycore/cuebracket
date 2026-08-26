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
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-[140] border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="cb-safe-top mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href="/" className="min-w-0 shrink truncate text-sm font-black text-cyan-300 sm:text-base">
            🎱 CueBracket Live
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-xs font-black uppercase tracking-wider text-slate-500 md:inline">
              Cloud spectator mode
            </span>
            <SpectatorAuthNav returnTo={`/cloud/live/${id}`} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <RealtimeCloudTournament id={id} />
      </div>
    </main>
  );
}
