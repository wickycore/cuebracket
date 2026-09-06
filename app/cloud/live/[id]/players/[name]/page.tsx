import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GuestPlayerAction } from "@/components/GuestPlayerAction";
import { SpectatorAuthNav } from "@/components/SpectatorAuthNav";
import { buildTournamentPlayerCard } from "@/lib/bracket/player-card";
import { normalizeParticipantName, participantProfilePath } from "@/lib/cloud/public-participants";
import { getPublicTournamentParticipants, getPublicTournamentSnapshot } from "@/lib/cloud/public-tournaments.server";
import { createClient } from "@/lib/supabase/server";
import type { BracketRound } from "@/lib/tournaments";

type Props = { params: Promise<{ id: string; name: string }> };

const outcomeStyles = {
  win: "text-[#57e6b8]",
  loss: "text-rose-300",
  live: "text-[#62c4ff]",
  upcoming: "text-[#a9bdd0]",
  bye: "text-violet-300",
} as const;

const outcomeLabels = {
  win: "W",
  loss: "L",
  live: "● Live",
  upcoming: "Upcoming",
  bye: "Advanced · BYE",
} as const;

function playerNames(rounds: BracketRound[]) {
  return rounds.flatMap((round) => round.matches.flatMap((match) => [match.player1, match.player2, match.winner])).filter((name): name is string => Boolean(name));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, name } = await params;
  const snapshot = await getPublicTournamentSnapshot(id);
  const displayName = name.trim();
  return snapshot.row
    ? {
        title: `${displayName} · ${snapshot.row.name}`,
        description: `${displayName}'s matches in ${snapshot.row.name} on CueBracket.`,
        robots: { index: false, follow: true },
      }
    : { title: "Tournament player" };
}

export default async function TournamentGuestPlayerPage({ params }: Props) {
  const { id, name } = await params;
  const [snapshot, participants] = await Promise.all([
    getPublicTournamentSnapshot(id),
    getPublicTournamentParticipants(id),
  ]);
  if (!snapshot.row) notFound();

  const tournament = snapshot.row;
  const rounds = tournament.bracket?.type === "single" ? tournament.bracket.rounds : [];
  const canonicalName = playerNames(rounds).find((candidate) => normalizeParticipantName(candidate) === normalizeParticipantName(name));
  if (!canonicalName) notFound();

  const registered = participants.find((participant) => normalizeParticipantName(participant.displayName) === normalizeParticipantName(canonicalName));
  if (registered) redirect(participantProfilePath(registered));

  const card = buildTournamentPlayerCard(rounds, canonicalName);
  if (!card) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isOrganizer = tournament.owner_id === user?.id;
  if (user && !isOrganizer) {
    const [{ data: collaborator }, { data: clubMember }] = await Promise.all([
      supabase.from("tournament_collaborators").select("id").eq("tournament_id", id).eq("user_id", user.id).eq("status", "accepted").maybeSingle(),
      tournament.club_id
        ? supabase.from("club_members").select("role").eq("club_id", tournament.club_id).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    isOrganizer = Boolean(collaborator || clubMember);
  }

  const returnPath = `/cloud/live/${encodeURIComponent(id)}/players/${encodeURIComponent(canonicalName)}`;

  return (
    <main className="min-h-screen bg-[#071a35] text-[#fafcff]">
      <header className="sticky top-0 z-40 border-b border-[#2a5680] bg-[#0d2a50]/95 backdrop-blur-xl">
        <div className="cb-safe-top mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href={`/cloud/live/${id}`} className="min-w-0 truncate text-sm font-black text-[#52d3ee] sm:text-base">← Tournament</Link>
          <SpectatorAuthNav returnTo={returnPath} />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-3 py-6 sm:px-5 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-[#315878] bg-[#091a2f] shadow-2xl shadow-black/30">
          <div className="border-b border-[#28445f] bg-[#102744] px-6 py-4">
            <p className="text-sm font-black text-[#57e6d1]">Tournament player</p>
          </div>

          <div className="px-6 py-8 text-center sm:px-8">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-dashed border-[#3f6f99] bg-[#17314f] text-3xl font-black text-[#91afd0]">{card.initials}</div>
            <h1 className="mt-4 text-3xl font-black">{card.name}</h1>
            <p className="mt-3 inline-flex rounded-full bg-[#173454] px-4 py-1.5 text-xs font-bold text-[#9fb4ca]">Guest or private player profile</p>
          </div>

          <div className="border-t border-[#28445f] px-6 py-6 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a9c1dc]">This tournament</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#102744] p-4 text-center"><p className="text-2xl font-black">{card.wins}–{card.losses}</p><p className="mt-1 text-xs text-[#91abc5]">played record</p></div>
              <div className="rounded-2xl bg-[#102744] p-4 text-center"><p className="text-2xl font-black">{card.latestRound}</p><p className="mt-1 text-xs text-[#91abc5]">latest round</p></div>
            </div>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-[#a9c1dc]">Matches here</p>
            <div className="mt-3 divide-y divide-[#213b55] border-l-4 border-[#57d6ad] bg-[#0b1c31]">
              {card.matches.map((match) => {
                const score = match.scoreFor !== null && match.scoreAgainst !== null ? ` · ${match.scoreFor}–${match.scoreAgainst}` : "";
                return (
                  <div key={match.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-black">{match.opponent ? `vs ${match.opponent}` : match.roundName}</span><span className="mt-0.5 block text-[11px] font-bold text-[#829db7]">{match.roundName}</span></span>
                    <span className={`shrink-0 text-right font-black ${outcomeStyles[match.outcome]}`}>{outcomeLabels[match.outcome]}{score}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 rounded-2xl border border-[#2e69a0] bg-[#102744] p-5 text-center">
              <h2 className="text-lg font-black">{isOrganizer ? `Bring ${card.name} onto CueBracket` : "Is this you?"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#9fb4ca]">{isOrganizer ? "Share a signup link so this player can create a profile and keep future records." : "Create or open your profile, then ask the organizer to verify and link this tournament entry. Guest records are never merged by name alone."}</p>
              <div className="mt-5"><GuestPlayerAction playerName={card.name} tournamentName={tournament.name} returnPath={returnPath} isOrganizer={isOrganizer} isSignedIn={Boolean(user)} /></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
