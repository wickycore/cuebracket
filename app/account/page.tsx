import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, platform_role, created_at")
    .eq("id", user!.id)
    .single();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
          User account
        </p>
        <h1 className="mt-3 text-4xl font-black">
          {profile?.display_name || "CueBracket Organizer"}
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            ["Email", user?.email],
            ["Role", profile?.platform_role ?? "organizer"],
            ["User ID", user?.id],
            ["Joined", profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 break-all font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
