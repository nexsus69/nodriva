import type { Metadata } from "next";
import "./globals.css";
import { CacheInitializer } from "./components/CacheInitializer";
import { RealtimeDebugOverlayHost } from "./components/realtime/RealtimeDebugOverlayHost";

export const metadata: Metadata = {
  title: "Dashboard Ultimate - Dynamic Hierarchy Platform",
  description: "Advanced hierarchical entity management platform with dynamic type system and transactional storage.",
};

import { auth } from "../auth";
import { SessionModalWatcher } from "./components/auth/SessionModalWatcher";
import { SessionProviderWrapper } from "./components/auth/SessionProviderWrapper";
import { SessionCacheSynchronizer } from "./components/auth/SessionCacheSynchronizer";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { ActivityProvider } from "./activity/ActivityProvider";
import { ActivityDebugOverlayHost } from "./activity/ActivityDebugOverlayHost";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#f4f7fb] text-slate-900 antialiased flex flex-col font-sans">
        <SessionProviderWrapper session={session}>
          <ActivityProvider initialExpires={session?.expires}>
            <CacheInitializer />
            <ActivityDebugOverlayHost />
            <RealtimeDebugOverlayHost />
            <SessionCacheSynchronizer />
            <SessionModalWatcher />
            <WorkspaceShell>{children}</WorkspaceShell>
          </ActivityProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
