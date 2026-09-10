"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cuebracket-walkthrough-v1";

const steps = [
  {
    icon: "🎱",
    kicker: "Welcome to CueBracket",
    title: "Your pool community in one place",
    detail: "Players can discover events, follow clubs and watch live brackets. Organizers can run tournaments, leagues and club activities from their dashboard.",
  },
  {
    icon: "🏆",
    kicker: "Step 1 · Play",
    title: "Find and enter a tournament",
    detail: "Open Live & Events, choose an event and tap Register. If sign-in is required, CueBracket brings you back to the same registration page afterward.",
  },
  {
    icon: "👥",
    kicker: "Step 2 · Clubs",
    title: "Follow and Join are different",
    detail: "Follow club keeps public events and updates close—membership is not required. Join club sends an approval request and unlocks the private member directory and clubhouse.",
  },
  {
    icon: "📡",
    kicker: "Step 3 · Watch",
    title: "Follow matches live",
    detail: "Open a public event to see the bracket, scores and results update in real time. Spectator links can be shared with anyone.",
  },
  {
    icon: "⚡",
    kicker: "Step 4 · Organize",
    title: "Run everything from your dashboard",
    detail: "Create tournaments and leagues, manage scores, publish registration links and control your club. Organizer tools ask you to sign in before making changes.",
  },
];

export function CueBracketWalkthrough() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let openTimer: number | undefined;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        openTimer = window.setTimeout(() => setOpen(true), 0);
      }
    } catch {
      // The manual tour button still works when storage is unavailable.
    }
    return () => {
      if (openTimer !== undefined) window.clearTimeout(openTimer);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function rememberAndClose() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "complete");
    } catch {
      // Closing the walkthrough should never depend on browser storage.
    }
    setOpen(false);
  }

  function startTour() {
    setStep(0);
    setOpen(true);
  }

  const current = steps[step];
  const lastStep = step === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        className="no-print fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-[115] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/25 bg-[#07101f]/95 px-4 py-2 text-xs font-black text-cyan-100 shadow-2xl shadow-black/50 backdrop-blur-xl hover:bg-[#0b1b30] md:bottom-5 md:right-5"
        aria-label="Open the CueBracket walkthrough"
      >
        <span aria-hidden="true">?</span>
        How to use CueBracket
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          rememberAndClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) rememberAndClose();
        }}
        aria-labelledby="cuebracket-tour-title"
        aria-describedby="cuebracket-tour-detail"
        className="m-auto w-[min(92vw,34rem)] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#07101f] p-0 text-white shadow-2xl shadow-black/70 backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Quick walkthrough</span>
            <button type="button" onClick={rememberAndClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-lg text-slate-300 hover:bg-white/5 hover:text-white" aria-label="Close walkthrough">×</button>
          </div>
          <div className="mt-4 flex gap-2" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-cyan-400" : "bg-white/10"}`} />)}
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-3xl" aria-hidden="true">{current.icon}</span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{current.kicker}</p>
          <h2 id="cuebracket-tour-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{current.title}</h2>
          <p id="cuebracket-tour-detail" className="mt-3 text-sm leading-7 text-slate-300">{current.detail}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/45 px-5 py-4 sm:px-6">
          {step > 0 ? <button type="button" onClick={() => setStep((value) => value - 1)} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-slate-300 hover:bg-white/5">← Back</button> : <button type="button" onClick={rememberAndClose} className="min-h-11 px-2 text-sm font-black text-slate-400 hover:text-white">Skip</button>}
          <button type="button" onClick={() => lastStep ? rememberAndClose() : setStep((value) => value + 1)} className="min-h-11 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 hover:bg-cyan-300">{lastStep ? "Start using CueBracket ✓" : "Next →"}</button>
        </div>
      </dialog>
    </>
  );
}
