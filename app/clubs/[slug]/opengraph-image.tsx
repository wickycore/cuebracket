import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "CueBracket club profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase.from("clubs").select("name,location,description,is_verified").eq("slug", slug.toLowerCase()).eq("is_public", true).maybeSingle();
  const name = club?.name ?? "CueBracket Club";
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", color: "#fafcff", background: "linear-gradient(135deg,#06101f 0%,#0d2a50 58%,#123763 100%)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#52d3ee", fontSize: 34, fontWeight: 800 }}><span style={{ display: "flex", width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", color: "#071a35", background: "#52d3ee" }}>8</span>CUEBRACKET CLUB</div>
    <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", alignItems: "center", gap: 20, maxWidth: 1060, fontSize: 72, lineHeight: 1.04, fontWeight: 900, letterSpacing: -2 }}><span>{name}</span>{club?.is_verified ? <span style={{ display: "flex", width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", color: "#06233a", background: "#4dd8c4", fontSize: 38 }}>✓</span> : null}</div><div style={{ display: "flex", marginTop: 24, color: "#c9d8e8", fontSize: 29 }}>{club?.location || "Pool community on CueBracket"}</div>{club?.is_verified ? <div style={{ display: "flex", marginTop: 24, width: "fit-content", borderRadius: 999, padding: "10px 18px", color: "#bff8ec", background: "#123d4b", fontSize: 22, fontWeight: 800 }}>Verified CueBracket club</div> : null}</div>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#9fb4ca", fontSize: 24 }}><span>{club?.description?.slice(0, 80) || "Events, rankings, achievements and community"}</span><span style={{ color: "#52d3ee", fontWeight: 800 }}>View club →</span></div>
  </div>, size);
}
