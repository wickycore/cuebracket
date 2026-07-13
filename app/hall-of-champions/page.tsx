import { AppHeader } from "@/components/AppHeader";
import { ChampionsGallery } from "@/components/ChampionsGallery";

export default function HallOfChampionsPage() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />
      <div className="cb-shell py-8 sm:py-10">
        <section className="cb-card relative overflow-hidden rounded-[2.2rem] border-amber-300/15 p-7 sm:p-10">
          <div className="pointer-events-none absolute -right-8 -top-20 text-[18rem] leading-none text-amber-300/[0.035]">♛</div>
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-amber-400/[0.06] blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Tournament history</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">The wall belongs to the winners.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              Every completed title, champion and final bracket preserved in one permanent gallery.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <ChampionsGallery />
        </section>
      </div>
    </main>
  );
}
