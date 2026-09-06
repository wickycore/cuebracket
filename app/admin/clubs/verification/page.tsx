import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClubVerificationAdmin, type EligibleClub } from "@/components/ClubVerificationAdmin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Club verification · CueBracket Admin", robots: { index: false, follow: false } };

export default async function ClubVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/clubs/verification");
  const { data, error } = await supabase.rpc("list_clubs_eligible_for_verification");
  if (error) redirect("/dashboard");
  return <main className="min-h-dvh bg-[#020617] text-white"><AppHeader /><div className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><p className="text-xs font-black uppercase tracking-[0.22em] text-teal-300">Platform administration</p><h1 className="mt-3 text-4xl font-black tracking-tight">Club verification</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Eligible clubs remain unverified until you review and approve them here. Organizers cannot access this screen or change their own badge.</p><section className="mt-8"><ClubVerificationAdmin initialClubs={(data ?? []) as EligibleClub[]} /></section></div></main>;
}
