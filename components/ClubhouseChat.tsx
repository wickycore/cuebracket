"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RemoteMedia } from "@/components/RemoteMedia";
import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import type { ClubChatMessageRow } from "@/lib/club-command-center";
import { deleteClubChatMessage, loadClubChatMessages, sendClubChatMessage, subscribeToClubChat } from "@/lib/cloud/club-chat";

export function ClubhouseChat({ clubId, userId, isAdmin, isMuted, members, initialMessages }: { clubId: string; userId: string; isAdmin: boolean; isMuted: boolean; members: ClubMemberView[]; initialMessages: ClubChatMessageRow[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

  const refresh = useCallback(async () => {
    try { setMessages(await loadClubChatMessages(clubId)); }
    catch { setNotice("Chat could not refresh. Check your connection."); }
  }, [clubId]);

  useEffect(() => subscribeToClubChat(clubId, () => void refresh()), [clubId, refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy || isMuted) return;
    setBusy(true); setNotice("");
    try {
      const message = await sendClubChatMessage(clubId, body);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setBody("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Message could not be sent."); }
    finally { setBusy(false); }
  }

  async function remove(message: ClubChatMessageRow) {
    if (!window.confirm("Delete this message?")) return;
    try { await deleteClubChatMessage(message.id); setMessages((current) => current.filter((item) => item.id !== message.id)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Message could not be deleted."); }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-900/70">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
        <div><p className="cb-kicker">Club chat</p><h2 className="mt-2 text-2xl font-black">Talk with the clubhouse</h2><p className="mt-1 text-sm text-slate-400">Live conversation for approved members.</p></div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">● Live</span>
      </header>
      <div className="max-h-[32rem] min-h-72 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length ? messages.map((message) => {
          const author = memberMap.get(message.author_id);
          const mine = message.author_id === userId;
          return <div key={message.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-cyan-300/10 text-sm font-black text-cyan-100">{author?.avatarUrl ? <RemoteMedia src={author.avatarUrl} alt="" width={72} height={72} sizes="36px" /> : (author?.name ?? "M").charAt(0).toUpperCase()}</span>
            <div className={`max-w-[82%] ${mine ? "text-right" : ""}`}><div className={`rounded-2xl px-4 py-3 text-left ${mine ? "rounded-tr-sm bg-cyan-400 text-slate-950" : "rounded-tl-sm border border-white/10 bg-slate-950/65 text-white"}`}><p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">{message.body}</p></div><div className={`mt-1 flex items-center gap-2 text-[11px] text-slate-500 ${mine ? "justify-end" : ""}`}><span className="font-bold">{mine ? "You" : author?.name ?? "Club member"}</span><time dateTime={message.created_at}>{new Intl.DateTimeFormat("en-KE", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(message.created_at))}</time>{mine || isAdmin ? <button type="button" onClick={() => void remove(message)} className="font-bold text-rose-300 hover:text-rose-200">Delete</button> : null}</div></div>
          </div>;
        }) : <div className="grid min-h-64 place-items-center text-center"><div><p className="text-3xl">💬</p><p className="mt-3 font-black text-white">Start the club conversation</p><p className="mt-1 text-sm text-slate-400">Say hello, arrange practice or talk about the next tournament.</p></div></div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-white/10 bg-slate-950/45 p-4 sm:p-5">
        {notice ? <p className="mb-3 text-sm font-bold text-amber-200">{notice}</p> : null}
        <div className="flex items-end gap-3"><label className="sr-only" htmlFor="club-chat-message">Message the club</label><textarea id="club-chat-message" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={isMuted || busy} maxLength={1000} rows={2} placeholder={isMuted ? "Your posting access is muted" : "Message the clubhouse…"} className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50 disabled:opacity-60" /><button type="submit" disabled={isMuted || busy || !body.trim()} className="min-h-12 rounded-2xl bg-cyan-400 px-5 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "…" : "Send"}</button></div>
      </form>
    </section>
  );
}
