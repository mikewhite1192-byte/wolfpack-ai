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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
