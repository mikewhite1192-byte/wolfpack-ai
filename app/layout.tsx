import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Wolf Pack AI — AI-Powered CRM for Sales Teams",
  description: "The AI sales agent that texts, qualifies, and books appointments for you. Automated follow-ups, pipeline management, and smart lead scoring.",
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
