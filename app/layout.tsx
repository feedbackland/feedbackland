import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
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
//  3. Scrollbar gutter: when embedded in the drawer, flag <html> so it always
//     reserves the viewport scrollbar gutter (see `html.fl-embed-drawer` in
//     globals.css). The widget's shimmer reserves one unconditionally, so a
//     sparse board — which `min-h-screen` pins to exactly 100vh, producing no
//     scrollbar at all — would otherwise widen the content column by the
//     scrollbar width the moment the shimmer handed over, shifting it sideways.
//     Set here rather than from the layout because only the root layout owns
//     <html>, and reading the proxy's header there would opt the last two
//     statically-rendered routes into dynamic rendering.
const bootScript = `(function(){try{var s=new URLSearchParams(window.location.search);var d=s.getAll('embed').includes('drawer');var m=s.get('mode');if(d&&(m==='dark'||m==='light')){window.localStorage.setItem('feedbackland-embed-theme',m);var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(m);e.style.colorScheme=m;}if(d){document.documentElement.classList.add('fl-embed-drawer');}}catch(e){}try{if(window.parent!==window){window.parent.postMessage({type:'feedbackland:loading'},'*');}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Feedback",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-muted/50 dark:bg-background">
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <Suspense>
          <ThemeProvider>
            <TooltipProvider delayDuration={0}>
              <NuqsAdapter>
                {children}
                <Toaster />
              </NuqsAdapter>
            </TooltipProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
