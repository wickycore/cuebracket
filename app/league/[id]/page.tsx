import Link from "next/link";
import { RealtimeCloudLeague } from "@/components/RealtimeCloudLeague";

export default async function PublicLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-black text-cyan-300">🎱 CueBracket Live</Link>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">Public league</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10"><RealtimeCloudLeague id={id} /></div>
    </main>
  );
}
