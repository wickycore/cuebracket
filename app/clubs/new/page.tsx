import { AppHeader } from "@/components/AppHeader";
import { ClubCreateForm } from "@/components/ClubCreateForm";

export default function NewClubPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Club foundation</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Give your club a home.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
          Create one public page for members, followers, registrations and every tournament your club hosts.
        </p>
        <ClubCreateForm />
      </div>
    </main>
  );
}
