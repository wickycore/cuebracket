import { AppHeader } from "@/components/AppHeader";
import { TournamentList } from "@/components/TournamentList";

export default function TournamentsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-400">Tournament library</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">All tournaments</h1>
        <p className="mb-10 mt-4 max-w-2xl text-slate-400">
          Search, open, duplicate or remove any tournament saved in this browser.
        </p>
        <TournamentList />
      </div>
    </main>
  );
}
