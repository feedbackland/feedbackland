"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

// Mirrors <WidgetDocs />: a 12-col grid (gap-8) with a sticky 4-col config card
// (header + 5 stacked fields + footer note) and an 8-col preview/code card whose
// preview / installation / usage sections are each preceded by a thin label bar.
export function WidgetDocsLoading() {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Configuration card */}
      <div className="lg:sticky lg:top-8 lg:col-span-4">
        <Card className="bg-background">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-full max-w-[260px]" />
          </CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
            <div className="border-border space-y-1.5 border-t pt-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview + code card */}
      <div className="space-y-4 lg:col-span-8">
        <div className="bg-background border-border overflow-hidden rounded-xl border shadow-xs">
          {/* Preview */}
          <div className="bg-muted/20 border-border flex items-center border-b px-4 py-2">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex min-h-[140px] w-full items-center justify-center px-4 py-8">
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          {/* Installation */}
          <div className="bg-muted/20 border-border flex items-center border-y px-4 py-2">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="p-3">
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>

          {/* Usage */}
          <div className="bg-muted/20 border-border flex items-center border-b px-4 py-2">
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
