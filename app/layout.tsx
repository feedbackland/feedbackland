import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { TRPCClientProvider } from "@/providers/trpc-client";
import { JotaiProvider } from "@/providers/jotai";
import { ThemeProvider } from "@/providers/theme";
import { Toaster } from "@/components/ui/sonner";

// Boot script — runs synchronously at parse time, before first paint and before
// the iframe's `load` event. It does two things:
//
//  1. Theme sync: the embedding widget passes the host's theme as
//     `?mode=dark|light`; apply it to <html> before first paint so the loading
//     skeleton and board render in the correct theme with no light→dark flash.
//     The value is written to an ISOLATED storage key (`feedbackland-embed-theme`,
//     which ThemeProvider reads only when embedded) — never next-themes' default
//     `theme` key — so embedding the board never clobbers a visitor's own
//     standalone theme preference at the same origin. No-ops without `mode`.
//
//  2. Capability handshake: post `feedbackland:loading` to the host as early as
//     possible. This tells a (new) embedding widget that this board speaks the
//     readiness protocol, so the widget keeps its shimmer up until the matching
//     `feedbackland:ready` (see platform-ready-signal). Posting it from here —
//     before `onLoad` and before React hydrates — guarantees the widget learns
//     this even when hydration is slow, so it never mistakes a new board for an
//     old one and reveals early.
const bootScript = `(function(){try{var m=new URLSearchParams(window.location.search).get('mode');if(m==='dark'||m==='light'){window.localStorage.setItem('feedbackland-embed-theme',m);var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(m);e.style.colorScheme=m;}}catch(e){}try{if(window.parent!==window){window.parent.postMessage({type:'feedbackland:loading'},'*');}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Feedbackland",
  description: "User Feedback Platform",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const roboto_mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${roboto_mono.variable}`}
    >
      <body className="bg-muted/40 dark:bg-background">
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <Suspense>
          <ThemeProvider>
            <TRPCClientProvider>
              <AuthProvider>
                <TooltipProvider delayDuration={0}>
                  <JotaiProvider>
                    <NuqsAdapter>
                      {children}
                      <Toaster />
                    </NuqsAdapter>
                  </JotaiProvider>
                </TooltipProvider>
              </AuthProvider>
            </TRPCClientProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
