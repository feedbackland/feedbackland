"use client";

import { CopyButton } from "@/components/ui/copy-button";

export function EndpointCard({ url }: { url: string }) {
  const fullUrl = url.length > 0 ? `${url}/api/feedback/create` : "…";

  return (
    <div className="bg-background border-border flex items-center gap-3 rounded-lg border px-3 py-2 shadow-xs">
      <span className="inline-flex items-center justify-center rounded-md bg-green-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-green-700 dark:bg-green-900/40 dark:text-green-300">
        POST
      </span>
      <code className="text-foreground flex-1 truncate font-mono text-sm">
        {fullUrl}
      </code>
      {url.length > 0 ? <CopyButton text={fullUrl} /> : null}
    </div>
  );
}
