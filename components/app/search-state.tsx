"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SearchError = {
  message: string;
  data?: { code?: string; retryAfterSeconds?: number } | null;
};
function RateLimit({ until, retry }: { until: number; retry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (now >= until) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(1000, until - now),
    );
    return () => clearTimeout(timer);
  }, [now, until]);
  return (
    <>
      <p>
        {now < until
          ? `Search is busy. Try again in ${Math.ceil((until - now) / 1000)} seconds.`
          : "You can retry this search now."}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={now < until}
        onClick={retry}
      >
        Try again
      </Button>
    </>
  );
}
export function SearchState({
  search,
  error,
  errorAt,
  onRestart,
  onRetry,
}: {
  search?: {
    mode: "exact" | "semantic";
    status: "ready" | "pending";
    truncated: boolean;
  };
  error?: SearchError | null;
  errorAt: number;
  onRestart: () => void;
  onRetry: () => void;
}) {
  if (error) {
    const code = error.data?.code;
    const seconds = error.data?.retryAfterSeconds ?? 60;
    return (
      <div role="alert" className="space-y-2 py-2 text-sm">
        {code === "FORBIDDEN" || code === "UNAUTHORIZED" ? (
          <>
            <p>
              {error.message === "SETUP_REQUIRED"
                ? "Complete board setup to search."
                : "Sign in with an administrator account to search Activity."}
            </p>
            <a
              className="underline"
              href={error.message === "SETUP_REQUIRED" ? "/setup" : "/"}
            >
              {error.message === "SETUP_REQUIRED"
                ? "Open setup"
                : "Go to the board"}
            </a>
          </>
        ) : code === "TOO_MANY_REQUESTS" ? (
          <RateLimit until={errorAt + seconds * 1000} retry={onRetry} />
        ) : error.message === "SEARCH_RESTART_REQUIRED" ? (
          <>
            <p>This search can no longer be continued.</p>
            <Button size="sm" variant="outline" onClick={onRestart}>
              Start a new search
            </Button>
          </>
        ) : (
          <>
            <p>Could not load search results.</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </>
        )}
      </div>
    );
  }
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
