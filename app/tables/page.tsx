import { AppHeader } from "@/components/AppHeader";
import { TableManager } from "@/components/TableManager";

export default function TablesPage() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />
      <div className="cb-shell py-8 sm:py-10">
        <section className="cb-card relative overflow-hidden rounded-[2.2rem] p-7 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_0.46fr] lg:items-end">
            <div>
              <p className="cb-kicker">Venue operations</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Keep every table moving.</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
                Mark tables available, playing or reserved and keep the floor clear before the next match is called.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Free", "Available"],
                ["Live", "Playing"],
                ["Held", "Reserved"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-center">
                  <p className="text-lg font-black text-white">{value}</p>
                  <p className="mt-1 text-[0.65rem] font-black uppercase tracking-wider text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <TableManager />
        </section>
      </div>
    </main>
  );
}
