/** Defines the root document metadata and providers for the Next.js application. */

import type { Metadata } from "next";
import "./globals.css";
import { CacheInitializer } from "./components/CacheInitializer";

export const metadata: Metadata = {
  title: "Nodriva - Dynamic data platform",
  description: "Piattaforma per la gestione gerarchica di entità, con tipi dinamici e archiviazione transazionale.",
};

import { auth } from "../auth";
import { SessionModalWatcher } from "./components/auth/SessionModalWatcher";
import { SessionProviderWrapper } from "./components/auth/SessionProviderWrapper";
import { SessionCacheSynchronizer } from "./components/auth/SessionCacheSynchronizer";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { ActivityProvider } from "./activity/ActivityProvider";
import { NavigationBlockerProvider } from "./navigation/NavigationBlocker";
import { ConfirmDialogHost } from "./components/ui/feedback/ConfirmDialog";
import { MutationOutcomeHost } from './mutations/MutationOutcomeHost';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full bg-[#f4f7fb] text-slate-900 antialiased flex flex-col font-sans">
        <SessionProviderWrapper session={session}>
          <ActivityProvider initialExpires={session?.expires}>
            <NavigationBlockerProvider>
              <CacheInitializer />
              <SessionCacheSynchronizer />
              <SessionModalWatcher />
              <WorkspaceShell>{children}</WorkspaceShell>
              <MutationOutcomeHost />
              <ConfirmDialogHost />
            </NavigationBlockerProvider>
          </ActivityProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
