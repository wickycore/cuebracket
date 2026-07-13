import { AppHeader } from "@/components/AppHeader";
import { CloudSyncPanel } from "@/components/CloudSyncPanel";
import { createClient } from "@/lib/supabase/server";

export default async function CloudPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#102b3d_0%,_#07111e_38%,_#020617_100%)] text-white">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
          Phase 6B cloud center
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">
          Score once. Update everywhere.
        </h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Signed in as {user?.email}. CueBracket now backs up every tournament
          change automatically and pushes live updates to spectators.
        </p>
        <div className="mt-8">
          <CloudSyncPanel />
        </div>
      </div>
    </main>
  );
}
