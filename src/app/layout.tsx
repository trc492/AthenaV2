import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GameConfigProvider } from "@/hooks/use-game-config";
import { EventProvider } from "@/hooks/use-event-config";
import { ServiceWorkerManager } from "@/components/sync/service-worker-manager";
import { SessionProvider } from "@/components/session-provider";
import { SonnerToaster } from "@/components/sonner-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "TRC Scouting",
  description: "Scouting app for TRC",
  icons: {
    apple: "/TRCLogo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <TooltipProvider>
          <SessionProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <GameConfigProvider>
                <EventProvider>{children}</EventProvider>
              </GameConfigProvider>
              <SonnerToaster />
              <ServiceWorkerManager />
            </ThemeProvider>
          </SessionProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
