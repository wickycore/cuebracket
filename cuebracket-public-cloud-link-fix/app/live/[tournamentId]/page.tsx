import { redirect } from "next/navigation";

export default async function LegacyPublicLiveRedirectPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;

  redirect(`/cloud/live/${encodeURIComponent(tournamentId)}`);
}
