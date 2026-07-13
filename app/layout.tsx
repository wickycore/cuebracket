import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CloudAutoSyncProvider } from "@/components/CloudAutoSyncProvider";
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
  title: {
    default: "CueBracket Pro — Pool Tournament Control",
    template: "%s | CueBracket Pro",
  },
  description:
    "Create pool tournaments, score matches, manage tables and share live brackets from one professional control room.",
  keywords: [
    "pool tournament",
    "billiards bracket",
    "live pool scores",
    "double elimination",
    "tournament manager",
  ],
  applicationName: "CueBracket Pro",
  authors: [{ name: "CueBracket Pro" }],
  creator: "CueBracket Pro",
  openGraph: {
    title: "CueBracket Pro",
    description: "Professional pool tournament management and live scoring.",
    type: "website",
  },
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <CloudAutoSyncProvider>{children}</CloudAutoSyncProvider>
      </body>
    </html>
  );
}
