"use client";

import { Skeleton } from "@/components/ui/skeleton";

// Mirrors <ApiDocs />: an intro paragraph then 6 sections (space-y-8), each a
// text-base h3 heading (space-y-3) over its body — single-row bordered cards for
// the endpoint and org-id, a tabs + code block for the example, a bordered table
// for the request body, and code blocks for the response/errors.
export function ApiDocsLoading() {
  return (
    <div className="space-y-8">
      {/* intro paragraph */}
      <div className="max-w-prose space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>

      {/* 1. Endpoint */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </section>

      {/* 2. Organization ID */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </section>

      {/* 3. Example request (tabs + code) */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </section>

      {/* 4. Request body (table: header + 2 rows) */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="bg-muted/30 border-border flex gap-4 border-b px-4 py-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="border-border flex gap-4 border-b px-4 py-2.5 last:border-b-0"
            >
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </section>

      {/* 5. Response */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </section>

      {/* 6. Errors */}
      <section className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </section>
    </div>
  );
}
