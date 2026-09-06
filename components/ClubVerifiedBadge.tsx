export function ClubVerifiedBadge({ labelled = false }: { labelled?: boolean }) {
  const explanation = "Verified club — meets CueBracket's activity and trust standards.";
  return <span title={explanation} aria-label={explanation} className="inline-flex shrink-0 items-center gap-1 align-middle text-[#4dd8c4]"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-[1em] w-[1em]" fill="currentColor"><circle cx="10" cy="10" r="9" /><path d="m6 10.2 2.4 2.4 5.7-6" fill="none" stroke="#06233a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>{labelled ? <span className="text-xs font-black text-teal-200">Verified club</span> : <span className="sr-only">Verified club</span>}</span>;
}
