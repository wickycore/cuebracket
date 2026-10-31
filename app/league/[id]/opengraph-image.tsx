import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import DefaultOpenGraphImage from "@/app/opengraph-image";

export const alt = "Pool league logo and live scores on CueBracket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Keep league artwork tied to its stable ID, including after a name change.
const NBK_LEAGUE_ID = "league-6f015497-05b2-4817-adf8-0045e53979a5";

export default async function LeagueImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== NBK_LEAGUE_ID) return DefaultOpenGraphImage();

  const reference = await readFile(join(process.cwd(), "assets/league-branding/nbk-reference.jpg"));
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "white" }}>
      {/* Frame the supplied logo, excluding the surrounding phone interface. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="NBK pool league logo" src={`data:image/jpeg;base64,${reference.toString("base64")}`} width={1134} height={2458} style={{ position: "absolute", left: 33, top: -1030 }} />
    </div>,
    size,
  );
}
