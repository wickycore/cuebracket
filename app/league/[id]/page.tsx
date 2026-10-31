import Link from "next/link";
import type { Metadata } from "next";
import { RealtimeCloudLeague } from "@/components/RealtimeCloudLeague";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("cloud_leagues").select("name, season").eq("id", id).eq("is_public", true).maybeSingle();
  const title = data ? `${data.name} · ${data.season}` : "Public league";
  const description = data ? `Follow ${data.name} fixtures, scores and standings live on CueBracket.` : "Follow public pool league fixtures, scores and standings on CueBracket.";
  const path = `/league/${id}`;
  const image = `${path}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website", url: path, siteName: "CueBracket Pro", title, description,
      images: [{ url: image, width: 1200, height: 630, alt: data ? `${data.name} league preview` : "CueBracket league preview" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PublicLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-black text-cyan-300">🎱 CueBracket Live</Link>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">Public league</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10"><RealtimeCloudLeague id={id} /></div>
    </main>
  );
}
