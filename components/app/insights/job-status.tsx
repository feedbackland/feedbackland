import { Spinner } from "@/components/ui/spinner";
import { insightFailureMessage } from "@/lib/insight-run";
import type { useGenerateInsights } from "@/hooks/use-generate-insights";

export function InsightJobStatus({
  job,
}: {
  job: ReturnType<typeof useGenerateInsights>;
}) {
  const run = job.latest.data;
  const css =
    "border-border bg-muted/40 mb-4 rounded-lg border px-4 py-3 text-sm";
  if (job.isGenerating)
    return (
      <div role="status" className={css}>
        <span className="flex items-center gap-2">
          <Spinner className="size-4" />
          Analysing feedback in the background.
        </span>
        {run?.status === "running" && (
          <p>
            Reading {run.postsAnalyzed} of {run.postsTotal} posts.
          </p>
        )}
      </div>
    );
  if (job.latest.isError)
    return (
      <div role="alert" className={css}>
        Could not read the latest analysis status.{" "}
        <button className="underline" onClick={() => void job.latest.refetch()}>
          Try again
        </button>
      </div>
    );
  const startError =
    !run || run.id === job.start.context?.previousId ? job.start.error : null;
  const reason =
    startError?.data?.reason ??
    startError?.message ??
    (run?.status === "failed" ? run.error : null);
  if (!reason) return null;
  const reset =
    startError?.data?.resetsAt ??
    (run?.finishedAt
      ? new Date(
          Date.UTC(
            run.finishedAt.getUTCFullYear(),
            run.finishedAt.getUTCMonth(),
            run.finishedAt.getUTCDate() + 1,
          ),
        ).toISOString()
      : null);
  return (
    <div role="alert" className={css}>
      {insightFailureMessage(reason)}{" "}
      {reason === "AI_PAUSED" && reset && (
        <>Allowance resets at {new Date(reset).toLocaleString()}.</>
      )}
    </div>
  );
}
