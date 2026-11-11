import { connection } from "next/server";
import { loadGameConfig } from "@/lib/server/game-config-store";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GameConfigProvider } from "@/hooks/use-game-config";
import { EventProvider } from "@/hooks/use-event-config";
import { ServiceWorkerManager } from "@/components/sync/service-worker-manager";
import { SessionProvider } from "@/components/session-provider";
import { SonnerToaster } from "@/components/sonner-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_DESCRIPTION, APP_LOGO, APP_NAME } from "@/lib/app-config";
import { GuestAccessBoundary } from "@/components/auth/guest-access-boundary";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    apple: APP_LOGO,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const gameConfig = loadGameConfig();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <TooltipProvider>
          <SessionProvider>
            <GuestAccessBoundary>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <GameConfigProvider initialConfig={gameConfig}>
                <EventProvider>{children}</EventProvider>
              </GameConfigProvider>
              <SonnerToaster />
              <ServiceWorkerManager />
            </ThemeProvider>
            </GuestAccessBoundary>
          </SessionProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
