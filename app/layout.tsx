import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { TRPCClientProvider } from "@/providers/trpc-client";
import { JotaiProvider } from "@/providers/jotai";
import { ThemeProvider } from "@/providers/theme";
import { IframeProvider } from "@/providers/iframe";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Feedbackland",
  description: "User Feedback Platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className="bg-background font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCClientProvider>
            <AuthProvider>
              <TooltipProvider>
                <JotaiProvider>
                  <NuqsAdapter>
                    <IframeProvider>
                      {children}
                      <Toaster />
                    </IframeProvider>
                  </NuqsAdapter>
                </JotaiProvider>
              </TooltipProvider>
            </AuthProvider>
          </TRPCClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
