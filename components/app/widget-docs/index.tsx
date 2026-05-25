"use client";

import { VariantCards } from "./variant-cards";
import { Playground } from "./playground";
import { StylingPatterns } from "./styling-patterns";
import {
  InstallCard,
  PlatformIdCard,
  PropsReference,
} from "./reference";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <p className="text-muted-foreground max-w-prose text-sm">
        Embed a feedback button anywhere in your React or Next.js app. The
        button opens either a slide-in <strong className="text-foreground">drawer</strong> or
        an anchored <strong className="text-foreground">popover</strong> — users submit, vote,
        and comment without ever leaving your product.
      </p>

      {/* Quick start: install + platform ID side-by-side on wide screens */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InstallCard />
        <PlatformIdCard orgId={orgId} />
      </div>

      {/* Variant comparison */}
      <section className="space-y-3">
        <header>
          <h3 className="text-base font-semibold tracking-tight">
            Pick a variant
          </h3>
          <p className="text-muted-foreground text-sm">
            Try each one against your own board.
          </p>
        </header>
        <VariantCards orgId={orgId} />
      </section>

      {/* Interactive playground */}
      <Playground orgId={orgId} orgSubdomain={orgSubdomain} />

      {/* Styling patterns */}
      <StylingPatterns orgId={orgId} />

      {/* Props reference */}
      <PropsReference />
    </div>
  );
}
