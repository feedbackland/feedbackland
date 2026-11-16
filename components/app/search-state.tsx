"use client";
import { Button } from "@/components/ui/button";
export function SearchState({
  search,
  error,
  onRestart,
}: {
  search?: {
    mode: "exact" | "semantic";
    status: "ready" | "pending";
    truncated: boolean;
  };
  error?: string;
  onRestart: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="space-y-2 py-2 text-sm">
        <p>
          {error === "SEARCH_BUSY"
            ? "Search is busy. Try again shortly."
            : error === "FORBIDDEN"
              ? "Administrator access is required."
              : "This search can no longer be continued."}
        </p>
        <Button size="sm" variant="outline" onClick={onRestart}>
          Start a new search
        </Button>
      </div>
    );
  if (!search) return null;
  return (
    <p role="status" className="text-muted-foreground py-2 text-xs">
      {search.status === "pending"
        ? "Preparing search results…"
        : search.mode === "semantic"
          ? "Approximate matches and exact matches from items awaiting indexing."
          : "Exact text matches."}
      {search.truncated &&
        " Showing a limited snapshot of up to 1,000 results. Narrow your search to see more."}
    </p>
  );
}
