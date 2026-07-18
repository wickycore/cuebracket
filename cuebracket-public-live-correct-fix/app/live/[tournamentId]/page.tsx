import { redirect } from "next/navigation";

export default async function LegacyPublicLivePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;

  redirect(`/cloud/live/${encodeURIComponent(tournamentId)}`);
}
