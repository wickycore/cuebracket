"use client";

export function PrintTournamentButton() {
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="no-print rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-300 transition hover:bg-cyan-400/20"
      >
        🖨 Print / Save PDF
      </button>
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print,
          header,
          nav,
          button,
          input,
          select,
          textarea {
            display: none !important;
          }
          main {
            background: white !important;
          }
          section,
          article,
          div {
            box-shadow: none !important;
          }
          [class*="bg-slate"],
          [class*="bg-white"] {
            background: white !important;
          }
          [class*="text-white"],
          [class*="text-slate"] {
            color: black !important;
          }
          [class*="border-white"] {
            border-color: #94a3b8 !important;
          }
        }
      `}</style>
    </>
  );
}
