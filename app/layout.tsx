import "@iframe-resizer/child";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TRPCClientProvider } from "@/providers/trpc-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feedbackland",
  description: "User Feedback Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          <TRPCClientProvider>
            <TooltipProvider>
              <NuqsAdapter>{children}</NuqsAdapter>
            </TooltipProvider>
          </TRPCClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
