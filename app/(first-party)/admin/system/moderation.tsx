"use client";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
export function ModerationCoverage() {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.getModerationCoverage.queryOptions(undefined, {
      refetchInterval: 30000,
    }),
  );
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Moderation coverage</h2>
      {query.data ? (
        <dl>
          <dt>Currently without full screening</dt>
          <dd>{query.data.current}</dd>
          <dt>Items published without full screening in the last 24 hours</dt>
          <dd>{query.data.recent}</dd>
        </dl>
      ) : (
        <p role="status">
          {query.isError
            ? "Moderation counts could not be loaded."
            : "Loading moderation counts…"}
        </p>
      )}
    </section>
  );
}
