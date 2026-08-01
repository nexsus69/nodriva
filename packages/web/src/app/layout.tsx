import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CacheInitializer } from "./components/CacheInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard Ultimate - Dynamic Hierarchy Platform",
  description: "Advanced hierarchical entity management platform with dynamic type system and transactional storage.",
};

import { auth } from "../auth";
import { SessionModalWatcher } from "./components/auth/SessionModalWatcher";
import { SessionProviderWrapper } from "./components/auth/SessionProviderWrapper";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased flex flex-col font-sans">
        <SessionProviderWrapper>
          <CacheInitializer />
          <SessionModalWatcher initialExpires={session?.expires} />
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
