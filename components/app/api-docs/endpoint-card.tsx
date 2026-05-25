"use client";

import { CopyButton } from "@/components/ui/copy-button";

export function EndpointCard({ url }: { url: string }) {
  const fullUrl = url ? `${url}/api/feedback/create` : "…";

  return (
    <div className="bg-background border-border rounded-lg border shadow-xs">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="inline-flex items-center justify-center rounded-md bg-green-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-green-700 dark:bg-green-900/40 dark:text-green-300">
          POST
        </span>
        <code className="text-foreground flex-1 truncate font-mono text-sm">
          {fullUrl}
        </code>
        {url ? <CopyButton text={fullUrl} /> : null}
      </div>
      <div className="border-border bg-muted/30 border-t px-4 py-2.5">
        <p className="text-muted-foreground text-xs">
          Public endpoint — no authentication required. Anyone with an
          organization ID can submit feedback.
        </p>
      </div>
    </div>
  );
}
