import { ImageResponse } from "next/og";

import { getPublicTournamentSnapshot } from "@/lib/cloud/public-tournaments.server";

export const alt = "CueBracket tournament live bracket and scores";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await getPublicTournamentSnapshot(id);
  const tournament = snapshot.row;
  const title = tournament?.name ?? "CueBracket Tournament";
  const status = tournament?.status === "live"
    ? "LIVE NOW"
    : tournament?.status === "completed"
      ? "FINAL RESULTS"
      : "COMING UP";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        color: "#fafcff",
        background: "linear-gradient(135deg, #071a35 0%, #0d2a50 58%, #123763 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#52d3ee", fontSize: 34, fontWeight: 800 }}>
          <span style={{ display: "flex", width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", color: "#071a35", background: "#52d3ee" }}>8</span>
          CUEBRACKET LIVE
        </div>
        <span style={{ display: "flex", borderRadius: 999, padding: "12px 22px", color: status === "LIVE NOW" ? "#071a35" : "#dce8f4", background: status === "LIVE NOW" ? "#78c69b" : "#1c4772", fontSize: 24, fontWeight: 800 }}>
          {status}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ maxWidth: 1020, fontSize: 72, lineHeight: 1.04, fontWeight: 900, letterSpacing: -2 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 26, gap: 18, color: "#c9d8e8", fontSize: 30 }}>
          <span>{tournament?.venue || "Venue to be announced"}</span>
          <span>·</span>
          <span>Race to {tournament?.race_to ?? "—"}</span>
          <span>·</span>
          <span>{(tournament?.format ?? "tournament").replaceAll("_", " ")}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#9fb4ca", fontSize: 24 }}>
        <span>Public read-only bracket, scores and results</span>
        <span style={{ color: "#52d3ee", fontWeight: 800 }}>Open to follow the action →</span>
      </div>
    </div>,
    size,
  );
}
