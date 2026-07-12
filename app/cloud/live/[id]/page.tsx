import Link from "next/link";
import { RealtimeCloudTournament } from "@/components/RealtimeCloudTournament";

export default async function CloudLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-black text-cyan-300">
            🎱 CueBracket Live
          </Link>
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Cloud spectator mode
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <RealtimeCloudTournament id={id} />
      </div>
    </main>
  );
}
