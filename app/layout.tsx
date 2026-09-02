import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CloudAutoSyncProvider } from "@/components/CloudAutoSyncProvider";
import { LeagueCloudSyncProvider } from "@/components/LeagueCloudSyncProvider";
import { PwaProvider } from "@/components/PwaProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cuebracket-doaa.vercel.app"),
  title: {
    default: "CueBracket Pro",
    template: "%s · CueBracket Pro",
  },
  description:
    "Run pool tournaments, live scores, brackets, tables, leagues and cloud spectator views.",
  applicationName: "CueBracket Pro",
  openGraph: {
    type: "website",
    siteName: "CueBracket Pro",
    title: "CueBracket Pro",
    description: "Run pool tournaments, live scores, brackets, tables, leagues and cloud spectator views.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CueBracket Pro",
    description: "Run pool tournaments, live scores, brackets, tables, leagues and cloud spectator views.",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CueBracket" },
  icons: { apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full">
        <PwaProvider><CloudAutoSyncProvider>
          <LeagueCloudSyncProvider>{children}</LeagueCloudSyncProvider>
        </CloudAutoSyncProvider></PwaProvider>
      </body>
    </html>
  );
}
