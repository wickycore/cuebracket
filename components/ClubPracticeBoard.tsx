"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { clubDateLabel, type ClubChallengeGame, type ClubChallengeRow, type ClubChallengeSkill } from "@/lib/club-command-center";
import { createClubChallenge, respondToClubChallenge } from "@/lib/cloud/club-challenges";

interface Props {
  clubId: string;
  clubSlug: string;
  userId: string | null;
  isMember: boolean;
  isAdmin: boolean;
  memberNames: Record<string, string>;
  initialChallenges: ClubChallengeRow[];
}

export function ClubPracticeBoard({ clubId, clubSlug, userId, isMember, isAdmin, memberNames, initialChallenges }: Props) {
  const router = useRouter();
  const [challenges, setChallenges] = useState(initialChallenges);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [gameType, setGameType] = useState<ClubChallengeGame>("8-ball");
  const [skillLevel, setSkillLevel] = useState<ClubChallengeSkill>("any");
  const [raceTo, setRaceTo] = useState("5");
  const [preferredAt, setPreferredAt] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key); setNotice("");
    try { await action(); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "That practice-board action could not be completed."); }
    finally { setBusy(""); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("create", async () => {
      const created = await createClubChallenge({
        clubId, title, message, gameType, skillLevel,
        raceTo: raceTo ? Number(raceTo) : null,
        preferredAt: preferredAt || null,
        venue,
        expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      });
      setChallenges((current) => [created, ...current]);
      setTitle(""); setMessage(""); setPreferredAt("");
      setNotice("Your challenge is live for club members.");
    });
  }

  function respond(item: ClubChallengeRow, action: "accept" | "reopen" | "close" | "open") {
    void run(`${action}-${item.id}`, async () => {
      const updated = await respondToClubChallenge(item.id, action);
      setChallenges((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setNotice(action === "accept" ? "Challenge accepted — time to arrange the match." : action === "close" ? "Challenge closed." : "Challenge reopened.");
    });
  }

  const visible = challenges.filter((item) => item.status !== "closed" && new Date(item.expires_at) > new Date());

  return <section className="rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.1),transparent_22rem),rgba(15,23,42,.65)] p-5 sm:p-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="cb-kicker !text-amber-300">Find your next match</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Challenges & practice board</h2><p className="mt-2 text-sm leading-6 text-slate-500">Members can find a practice partner without filling the main club chat.</p></div><span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">{visible.filter((item) => item.status === "open").length} open</span></div>

    {isMember ? <details className="mt-5 rounded-2xl border border-amber-300/15 bg-slate-950/40 p-4 sm:p-5"><summary className="cursor-pointer list-none font-black text-amber-100">+ Post a practice challenge</summary><form onSubmit={submit} className="mt-5 grid gap-3">
      <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={80} required placeholder="e.g. Looking for a race to 7 tonight" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 font-bold" />
      <div className="grid gap-3 sm:grid-cols-3"><select value={gameType} onChange={(event) => setGameType(event.target.value as ClubChallengeGame)} aria-label="Game type" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold"><option value="8-ball">8-ball</option><option value="9-ball">9-ball</option><option value="10-ball">10-ball</option><option value="blackball">Blackball</option><option value="snooker">Snooker</option><option value="any">Any game</option></select><select value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as ClubChallengeSkill)} aria-label="Skill level" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold"><option value="any">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><input type="number" value={raceTo} onChange={(event) => setRaceTo(event.target.value)} min={1} max={50} placeholder="Race to" aria-label="Race length" className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-4 font-bold" /></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-wider text-slate-500">Preferred time<input type="datetime-local" value={preferredAt} onChange={(event) => setPreferredAt(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white" /></label><label className="text-xs font-black uppercase tracking-wider text-slate-500">Venue or table<input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={100} placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white" /></label></div>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={3} placeholder="Anything your practice partner should know?" className="resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3" />
      <button type="submit" disabled={Boolean(busy)} className="min-h-12 rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{busy === "create" ? "Posting…" : "Post for 14 days"}</button>
    </form></details> : userId ? <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-5"><p className="font-black text-white">Want to challenge a club player?</p><p className="mt-2 text-sm text-slate-500">Join the club first so the board stays trusted and useful.</p></div> : <Link href={`/auth/login?next=${encodeURIComponent(`/clubs/${clubSlug}?tab=clubhouse`)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950">Sign in to join the board</Link>}

    {notice ? <p role="status" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">{notice}</p> : null}

    {visible.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{visible.map((item) => {
      const creator = memberNames[item.creator_id] || "Club member";
      const accepter = item.accepted_by ? memberNames[item.accepted_by] || "Club member" : null;
      const own = userId === item.creator_id;
      const acceptedOwn = userId === item.accepted_by;
      return <article key={item.id} className={`rounded-2xl border p-5 ${item.status === "matched" ? "border-emerald-300/20 bg-emerald-300/[0.045]" : "border-white/10 bg-slate-950/45"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[0.62rem] font-black uppercase tracking-wider text-amber-300">{item.game_type === "any" ? "Any cue game" : item.game_type} · {item.skill_level === "any" ? "Any level" : item.skill_level}</p><h3 className="mt-2 text-lg font-black">{item.title}</h3><p className="mt-1 text-xs font-bold text-slate-600">Posted by {creator}</p></div><span className={`rounded-full px-2.5 py-1 text-[0.6rem] font-black uppercase ${item.status === "matched" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{item.status}</span></div>
        {item.message ? <p className="mt-3 text-sm leading-6 text-slate-400">{item.message}</p> : null}<div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-slate-400">{item.race_to ? <span className="rounded-full border border-white/10 px-3 py-1.5">Race to {item.race_to}</span> : null}{item.preferred_at ? <span className="rounded-full border border-white/10 px-3 py-1.5">{clubDateLabel(item.preferred_at)}</span> : null}{item.venue ? <span className="rounded-full border border-white/10 px-3 py-1.5">📍 {item.venue}</span> : null}</div>
        {item.status === "matched" ? <p className="mt-4 rounded-xl bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">Matched with {accepter}. Arrange the table and play.</p> : null}
        {isMember ? <div className="mt-4 flex flex-wrap gap-2">{item.status === "open" && !own ? <button type="button" onClick={() => respond(item, "accept")} disabled={Boolean(busy)} className="min-h-11 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">Accept challenge</button> : null}{item.status === "matched" && (own || acceptedOwn || isAdmin) ? <button type="button" onClick={() => respond(item, "reopen")} disabled={Boolean(busy)} className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-300">Reopen</button> : null}{own || isAdmin ? <button type="button" onClick={() => respond(item, "close")} disabled={Boolean(busy)} className="min-h-11 rounded-xl border border-rose-300/20 px-4 py-2 text-sm font-black text-rose-200">Close</button> : null}</div> : null}
      </article>;
    })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><p className="font-black text-slate-300">No open practice challenges.</p><p className="mt-2 text-sm text-slate-600">Be the first member to call the next friendly match.</p></div>}
  </section>;
}
