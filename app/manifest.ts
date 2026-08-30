import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "CueBracket Pro", short_name: "CueBracket",
    description: "Your pool tournaments, clubs and match alerts in one place.",
    start_url: "/dashboard", scope: "/", display: "standalone",
    background_color: "#020617", theme_color: "#020617", lang: "en",
    icons: [192, 512].flatMap((size) => (["any", "maskable"] as const).map((purpose) => ({ src: `/pwa-icon/${size}`, sizes: `${size}x${size}`, type: "image/png", purpose }))),
    shortcuts: [
      { name: "My dashboard", url: "/dashboard" },
      { name: "Discover events", url: "/events" },
      { name: "Notifications", url: "/notifications" },
    ],
  };
}
