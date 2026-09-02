import { ImageResponse } from "next/og";

export const alt = "CueBracket Pro — run pool tournaments live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", color: "white", background: "linear-gradient(135deg,#020617 0%,#082f49 56%,#0f172a 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ width: "92px", height: "92px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "28px", background: "#22d3ee", color: "#020617", fontSize: "42px", fontWeight: 900 }}>8</div>
        <div style={{ display: "flex", fontSize: "34px", fontWeight: 800, letterSpacing: "-1px" }}>CueBracket Pro</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", maxWidth: "980px", fontSize: "72px", lineHeight: 1.02, fontWeight: 900, letterSpacing: "-4px" }}>Run the room. Share every shot.</div>
        <div style={{ display: "flex", fontSize: "29px", color: "#a5f3fc" }}>Brackets · Live scores · Clubs · Leagues · Player alerts</div>
      </div>
    </div>,
    size,
  );
}
