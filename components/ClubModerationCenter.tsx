"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ClubMemberView } from "@/components/ClubCommunityPanel";
import { RemoteMedia } from "@/components/RemoteMedia";
import type { ClubRole } from "@/lib/clubs";
import type { ClubMemberBlockRow, ClubMemberReportRow, ClubMemberRestrictionRow } from "@/lib/club-command-center";
import { removeClubMember } from "@/lib/cloud/clubs";
import { blockClubMember, reviewClubReport, setClubMemberRestriction, unblockClubMember } from "@/lib/cloud/club-moderation";

interface Props {
  clubId: string;
  userId: string;
  role: Extract<ClubRole, "owner" | "admin">;
  members: ClubMemberView[];
  initialReports: ClubMemberReportRow[];
  initialRestrictions: ClubMemberRestrictionRow[];
  initialBlocks: ClubMemberBlockRow[];
}

const reportLabels = { harassment: "Harassment", spam: "Spam", unsafe_conduct: "Unsafe conduct", club_rules: "Club rules", other: "Other" };

export function ClubModerationCenter({ clubId, userId, role, members, initialReports, initialRestrictions, initialBlocks }: Props) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [restrictions, setRestrictions] = useState(initialRestrictions);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const restrictionByUser = useMemo(() => new Map(restrictions.map((item) => [item.user_id, item])), [restrictions]);
  const manageable = members.filter((member) => member.userId !== userId && member.role !== "owner" && (role === "owner" || member.role === "member"));
  const openReports = reports.filter((report) => report.status === "open");

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await action();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That moderation action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  function changeRestriction(member: ClubMemberView, field: "is_suspended" | "is_muted") {
    const current = restrictionByUser.get(member.userId);
    const next = {
      isSuspended: field === "is_suspended" ? !current?.is_suspended : Boolean(current?.is_suspended),
      isMuted: field === "is_muted" ? !current?.is_muted : Boolean(current?.is_muted),
    };
    void run(`${field}:${member.userId}`, async () => {
      const updated = await setClubMemberRestriction({ clubId, userId: member.userId, ...next, reason: reason[member.userId] ?? current?.reason ?? "" });
      setRestrictions((items) => updated ? [...items.filter((item) => item.user_id !== member.userId), updated] : items.filter((item) => item.user_id !== member.userId));
      setMessage(`${member.name}'s club access was updated.`);
    });
  }

  return <section className="overflow-hidden rounded-[2rem] border border-rose-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,.1),transparent_24rem),rgba(15,23,42,.68)]">
    <div className="border-b border-white/10 p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-rose-300">Community safety</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Moderation center</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review reports and protect the clubhouse. Owner-only controls automatically apply when the target is an admin.</p></div><span className="w-fit rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-black text-rose-100">{openReports.length} open report{openReports.length === 1 ? "" : "s"}</span></div></div>
    <div className="space-y-7 p-5 sm:p-7">
      <div><h3 className="font-black text-white">Member reports</h3>{reports.length ? <div className="mt-3 space-y-3">{reports.map((report) => <article key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{report.reported_name}</p><p className="mt-1 text-xs font-black uppercase tracking-wider text-rose-300">{reportLabels[report.category]} · {report.status}</p></div><time className="text-xs font-bold text-slate-400">{new Date(report.created_at).toLocaleDateString("en-KE")}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{report.details}</p>{report.status === "open" ? <div className="mt-4 flex gap-2"><button type="button" onClick={() => void run(`review:${report.id}`, async () => { const updated = await reviewClubReport(report.id, "reviewed"); setReports((items) => items.map((item) => item.id === report.id ? updated : item)); })} className="min-h-10 rounded-xl bg-emerald-300 px-4 text-xs font-black text-slate-950">Mark reviewed</button><button type="button" onClick={() => void run(`dismiss:${report.id}`, async () => { const updated = await reviewClubReport(report.id, "dismissed"); setReports((items) => items.map((item) => item.id === report.id ? updated : item)); })} className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300">Dismiss</button></div> : null}</article>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No member reports have been submitted.</p>}</div>

      <div><h3 className="font-black text-white">Access controls</h3><p className="mt-1 text-xs leading-5 text-slate-400">Suspend removes member-only access. Mute keeps read access but prevents practice posts and challenge acceptance. Block removes membership and prevents rejoining.</p><div className="mt-3 space-y-3">{manageable.map((member) => { const restriction = restrictionByUser.get(member.userId); return <article key={member.userId} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-cyan-300/10 font-black text-cyan-200">{member.avatarUrl ? <RemoteMedia src={member.avatarUrl} alt={`${member.name} profile picture`} width={88} height={88} sizes="44px" /> : member.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{member.name}</span><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{member.role}{restriction?.is_suspended ? " · Suspended" : ""}{restriction?.is_muted ? " · Muted" : ""}</span></span></div><input value={reason[member.userId] ?? restriction?.reason ?? ""} onChange={(event) => setReason((current) => ({ ...current, [member.userId]: event.target.value }))} maxLength={500} placeholder="Reason or private organizer note (optional)" className="mt-3 min-h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-xs text-white" /><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><button type="button" onClick={() => changeRestriction(member, "is_suspended")} disabled={Boolean(busy)} className={`min-h-10 rounded-xl border px-3 text-xs font-black ${restriction?.is_suspended ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-200"}`}>{restriction?.is_suspended ? "Restore access" : "Suspend"}</button><button type="button" onClick={() => changeRestriction(member, "is_muted")} disabled={Boolean(busy)} className={`min-h-10 rounded-xl border px-3 text-xs font-black ${restriction?.is_muted ? "border-emerald-300/20 text-emerald-200" : "border-violet-300/20 text-violet-200"}`}>{restriction?.is_muted ? "Unmute" : "Mute"}</button><button type="button" onClick={() => void run(`remove:${member.userId}`, async () => { await removeClubMember(clubId, member.userId); setMessage(`${member.name} was removed from the club.`); })} disabled={Boolean(busy)} className="min-h-10 rounded-xl border border-rose-300/20 px-3 text-xs font-black text-rose-200">Remove</button><button type="button" onClick={() => void run(`block:${member.userId}`, async () => { const blockReason = reason[member.userId] ?? ""; await blockClubMember({ clubId, userId: member.userId, userName: member.name, reason: blockReason }); setBlocks((items) => [{ club_id: clubId, user_id: member.userId, user_name: member.name, blocked_by: userId, reason: blockReason, created_at: new Date().toISOString() }, ...items]); setMessage(`${member.name} was blocked and removed.`); })} disabled={Boolean(busy)} className="min-h-10 rounded-xl bg-rose-300 px-3 text-xs font-black text-slate-950">Block</button></div></article>; })}</div></div>

      {blocks.length ? <div><h3 className="font-black text-white">Blocked accounts</h3><div className="mt-3 space-y-2">{blocks.map((block) => <div key={block.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"><span className="min-w-0"><span className="block truncate text-sm font-black text-white">{block.user_name}</span><span className="block truncate text-xs text-slate-400">{block.reason || "No reason added"}</span></span><button type="button" onClick={() => void run(`unblock:${block.user_id}`, async () => { await unblockClubMember(clubId, block.user_id); setBlocks((items) => items.filter((item) => item.user_id !== block.user_id)); setMessage(`${block.user_name} can request membership again.`); })} disabled={Boolean(busy)} className="min-h-10 shrink-0 rounded-xl border border-emerald-300/20 px-3 text-xs font-black text-emerald-200">Unblock</button></div>)}</div></div> : null}
      {message ? <p role="status" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-200">{message}</p> : null}
    </div>
  </section>;
}
