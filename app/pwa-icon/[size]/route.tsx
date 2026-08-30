import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export function generateStaticParams() { return [180, 192, 512].map((size) => ({ size: String(size) })); }

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: value } = await params;
  const size = Number(value);
  if (![180, 192, 512].includes(size)) return new Response("Not found", { status: 404 });
  // Reuse the header's cyan 8 brand mark, with safe padding for masked icons.
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#020617", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "64%", height: "64%", borderRadius: size * 0.15, background: "#22d3ee", color: "#020617", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, fontWeight: 900 }}>8</div></div>, { width: size, height: size });
}
