import { TVMode } from "@/components/TVMode";

export default async function DisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TVMode tournamentId={id} />;
}
