import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Wolf Pack AI — AI-Powered CRM for Sales Teams",
  description: "The AI sales agent that texts, qualifies, and books appointments for you. Automated follow-ups, pipeline management, and smart lead scoring.",
  openGraph: {
    title: "The Wolf Pack AI — Your AI Sales Agent That Never Sleeps",
    description: "Responds in seconds. Qualifies leads. Books appointments. 24/7.",
    url: "https://thewolfpack.ai",
    siteName: "The Wolf Pack AI",
    images: [{ url: "https://thewolfpack.ai/api/og", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wolf Pack AI — Your AI Sales Agent That Never Sleeps",
    description: "Responds in seconds. Qualifies leads. Books appointments. 24/7.",
    images: ["https://thewolfpack.ai/api/og"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#0a0a0a" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="WolfPack" />
          <link rel="apple-touch-icon" href="/app-icon-192.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
