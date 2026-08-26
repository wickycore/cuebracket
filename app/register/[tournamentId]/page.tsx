import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentRegistrationForm } from "@/components/TournamentRegistrationForm";
import type { EventRegistrationRow, RegistrationSettingsRow } from "@/lib/cloud/registrations";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ tournamentId: string }>;
}

async function getSettings(tournamentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registration_settings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  return data as RegistrationSettingsRow | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tournamentId } = await params;
  const settings = await getSettings(tournamentId);
  return settings
    ? { title: `Register · ${settings.event_name}`, description: `Register to play in ${settings.event_name} on CueBracket.` }
    : { title: "Tournament registration" };
}

export default async function TournamentRegistrationPage({ params }: Props) {
  const { tournamentId } = await params;
  const supabase = await createClient();
  const { data: settingsData } = await supabase
    .from("event_registration_settings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  const settings = settingsData as RegistrationSettingsRow | null;
  if (!settings) notFound();

  const { data: club } = settings.club_id
    ? await supabase.from("clubs").select("name, slug").eq("id", settings.club_id).maybeSingle()
    : { data: null };

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: registrationRows }, ownRegistrationResult] = await Promise.all([
    user
      ? supabase.from("profiles").select("tournament_name, display_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("event_registrations")
      .select("id, tournament_id, display_name, status, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true }),
    user
      ? supabase
          .from("event_registrations")
          .select("id, display_name, status")
          .eq("tournament_id", tournamentId)
          .eq("profile_id", user.id)
          .not("status", "in", "(withdrawn,rejected)")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const registrations = (registrationRows ?? []) as Array<Pick<EventRegistrationRow, "id" | "display_name" | "status">>;
  const ownRegistration = ownRegistrationResult.data as Pick<EventRegistrationRow, "id" | "display_name" | "status"> | null;
  const publicRegistrations = registrations.filter((item) => ["approved", "waitlisted", "checked_in"].includes(item.status));
  const initialName = ownRegistration?.display_name || profile?.tournament_name || profile?.display_name || "";

  return (
    <main className="min-h-dvh overflow-x-clip bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.14),transparent_30rem),radial-gradient(circle_at_90%_30%,rgba(16,185,129,0.08),transparent_30rem)]" />
      <header className="relative border-b border-white/10 bg-[#020617]/90">
        <div className="cb-safe-top mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-black">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-sm text-slate-950">8</span>
            CueBracket
          </Link>
          {user ? <Link href="/account" className="rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-slate-300 ring-1 ring-white/10">My profile</Link> : <Link href={`/auth/login?next=${encodeURIComponent(`/register/${tournamentId}`)}`} className="text-sm font-black text-cyan-300">Sign in</Link>}
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="mb-7 overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(3,20,33,0.96))] p-6 shadow-2xl shadow-black/30 sm:p-9">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Open tournament registration</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{settings.event_name}</h1>
              {club ? <Link href={`/clubs/${club.slug}`} className="mt-2 inline-block text-sm font-black text-cyan-300 hover:text-cyan-200">Hosted by {club.name} →</Link> : null}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-400">
                {settings.venue ? <span>📍 {settings.venue}</span> : null}
                <span>🎱 Race to {settings.race_to}</span>
                <span>👥 {settings.capacity} places</span>
                {settings.entry_fee ? <span>🎟️ {settings.entry_fee}</span> : null}
              </div>
            </div>
            {settings.scheduled_at ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-5 py-4 md:text-right">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Starts</p>
                <p className="mt-1 font-black text-white">{new Date(settings.scheduled_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            ) : null}
          </div>
          {settings.notes ? <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-slate-300">{settings.notes}</p> : null}
        </section>

        <TournamentRegistrationForm
          settings={settings}
          profileId={user?.id ?? null}
          initialName={initialName}
          initialRegistration={ownRegistration}
          publicRegistrations={publicRegistrations}
        />
      </div>
    </main>
  );
}
