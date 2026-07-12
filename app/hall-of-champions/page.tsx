import { AppHeader } from "@/components/AppHeader";
import { ChampionsGallery } from "@/components/ChampionsGallery";

export default function HallOfChampionsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">History</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Hall of Champions.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Every completed title, winner and final bracket in one permanent gallery.</p>
        <div className="mt-8"><ChampionsGallery /></div>
      </div>
    </main>
  );
}
