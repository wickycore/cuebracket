"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  subscribeToClubAnnouncements,
  updateClubAnnouncement,
} from "@/lib/cloud/club-announcements";
import {
  clubAnnouncementLabel,
  clubDateLabel,
  type ClubAnnouncementKind,
  type ClubAnnouncementRow,
} from "@/lib/club-command-center";

const kindStyle: Record<ClubAnnouncementKind, string> = {
  general: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  event: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  venue: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  league: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  result: "border-sky-300/20 bg-sky-300/10 text-sky-200",
};

export function ClubAnnouncementBoard({
  clubId,
  initialAnnouncements,
  isAdmin,
}: {
  clubId: string;
  initialAnnouncements: ClubAnnouncementRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [kind, setKind] = useState<ClubAnnouncementKind>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToClubAnnouncements(clubId, () => router.refresh()), [clubId, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("create");
    setMessage("");
    try {
      const row = await createClubAnnouncement({ clubId, kind, title, body, isPinned });
      setAnnouncements((current) => [row, ...current]);
      setTitle("");
      setBody("");
      setIsPinned(false);
      setMessage("Announcement published.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish this announcement.");
    } finally {
      setBusy("");
    }
  }

  async function togglePin(item: ClubAnnouncementRow) {
    setBusy(item.id);
    setMessage("");
    try {
      const updated = await updateClubAnnouncement(item.id, { is_pinned: !item.is_pinned });
      setAnnouncements((current) => current.map((row) => row.id === updated.id ? updated : row));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this announcement.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: ClubAnnouncementRow) {
    if (!window.confirm(`Remove “${item.title}”?`)) return;
    setBusy(item.id);
    setMessage("");
    try {
      await deleteClubAnnouncement(item.id);
      setAnnouncements((current) => current.filter((row) => row.id !== item.id));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this announcement.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section id="club-announcements" className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cb-kicker">Club noticeboard</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Announcements</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-400">{announcements.length} update{announcements.length === 1 ? "" : "s"}</span>
      </div>

      {isAdmin ? (
        <details className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4 sm:p-5">
          <summary className="cursor-pointer list-none font-black text-cyan-100">+ Post a club announcement</summary>
          <form onSubmit={submit} className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <select value={kind} onChange={(event) => setKind(event.target.value as ClubAnnouncementKind)} aria-label="Announcement type" className="min-h-12 rounded-xl border border-white/10 bg-slate-950/75 px-3 font-bold text-white">
                <option value="general">Club update</option>
                <option value="event">Event</option>
                <option value="venue">Venue</option>
                <option value="league">League</option>
                <option value="result">Result</option>
              </select>
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={100} required placeholder="Short announcement title" className="min-h-12 rounded-xl border border-white/10 bg-slate-950/75 px-4 font-bold text-white outline-none focus:border-cyan-300/50" />
            </div>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={1000} required rows={4} placeholder="What should club members know?" className="resize-none rounded-xl border border-white/10 bg-slate-950/75 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-300"><input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4 accent-cyan-400" /> Pin this to the club home</label>
              <button type="submit" disabled={Boolean(busy)} className="min-h-12 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{busy === "create" ? "Publishing…" : "Publish announcement"}</button>
            </div>
          </form>
        </details>
      ) : null}

      {message ? <p role="status" className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100">{message}</p> : null}

      {announcements.length ? (
        <div className="mt-5 space-y-3">
          {announcements.map((item) => (
            <article key={item.id} className={`relative overflow-hidden rounded-2xl border p-5 ${item.is_pinned ? "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(8,47,73,.55),rgba(15,23,42,.82))]" : "border-white/10 bg-slate-950/45"}`}>
              {item.is_pinned ? <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 to-blue-500" /> : null}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-wider ${kindStyle[item.kind]}`}>{clubAnnouncementLabel(item.kind)}</span>
                    {item.is_pinned ? <span className="text-[0.62rem] font-black uppercase tracking-wider text-cyan-300">Pinned</span> : null}
                  </div>
                  <h3 className="mt-3 text-lg font-black text-white">{item.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{item.body}</p>
                  <p className="mt-3 text-xs font-bold text-slate-600">{clubDateLabel(item.published_at)}</p>
                </div>
                {isAdmin ? <div className="flex gap-2"><button type="button" onClick={() => void togglePin(item)} disabled={Boolean(busy)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300">{item.is_pinned ? "Unpin" : "Pin"}</button><button type="button" onClick={() => void remove(item)} disabled={Boolean(busy)} className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-black text-rose-200">Remove</button></div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center"><p className="font-black text-slate-300">The noticeboard is ready.</p><p className="mt-2 text-sm text-slate-600">Club updates, venue notices and results will appear here.</p></div>}
    </section>
  );
}
