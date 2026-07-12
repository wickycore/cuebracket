import { AppHeader } from "@/components/AppHeader";
import { TableManager } from "@/components/TableManager";

export default function TablesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">Venue operations</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Table Management.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Track available, playing and reserved pool tables during busy tournament nights.</p>
        <div className="mt-8"><TableManager /></div>
      </div>
    </main>
  );
}
