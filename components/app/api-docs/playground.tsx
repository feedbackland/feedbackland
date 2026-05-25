"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Error as ErrorAlert } from "@/components/ui/error";
import { CopyButton } from "@/components/ui/copy-button";
import { useTRPC } from "@/providers/trpc-client";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 10_000;

type SendResult = {
  status: number;
  durationMs: number;
  body: unknown;
  postId: string | null;
};

const prettyJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const statusBadgeClass = (status: number) => {
  if (status >= 200 && status < 300) {
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }
  if (status >= 400 && status < 500) {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
};

export function Playground({
  url,
  orgId,
  description,
  setDescription,
}: {
  url: string;
  orgId: string;
  description: string;
  setDescription: (next: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [deletedPostId, setDeletedPostId] = useState<string | null>(null);

  const charCount = description.length;
  const trimmedLength = description.trim().length;
  const overLimit = charCount > MAX_LENGTH;
  const canSend =
    !isSending && url.length > 0 && trimmedLength > 0 && !overLimit;

  const deletePost = useMutation(
    trpc.deleteFeedbackPost.mutationOptions({
      onSuccess: (_data, vars) => {
        setDeletedPostId(vars.postId);
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });
      },
    }),
  );

  const handleSend = async () => {
    setNetworkError(null);
    setResult(null);
    setDeletedPostId(null);
    setIsSending(true);

    const started = performance.now();
    try {
      const res = await fetch(`${url}/api/feedback/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, description }),
      });
      const durationMs = Math.round(performance.now() - started);

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }

      const postId =
        res.ok && body && typeof body === "object" && "id" in body
          ? String((body as { id: unknown }).id)
          : null;

      setResult({ status: res.status, durationMs, body, postId });
    } catch (err) {
      setNetworkError(
        err instanceof Error ? err.message : "Network request failed",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setDescription("");
    setResult(null);
    setNetworkError(null);
    setDeletedPostId(null);
  };

  const canReset =
    !isSending &&
    (description.length > 0 ||
      result !== null ||
      networkError !== null ||
      deletedPostId !== null);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="api-org-id">orgId</Label>
        <div className="flex items-center gap-2">
          <code
            id="api-org-id"
            className="border-input bg-muted/30 text-foreground flex-1 truncate rounded-md border px-3 py-2 font-mono text-xs"
          >
            {orgId}
          </code>
          <CopyButton text={orgId} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="api-description">description</Label>
          <span
            className={cn(
              "text-muted-foreground text-xs tabular-nums",
              overLimit && "text-destructive font-medium",
            )}
          >
            {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
          </span>
        </div>
        <Textarea
          id="api-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Share any feedback..."
          rows={4}
          disabled={isSending}
        />
        {overLimit && (
          <p className="text-destructive text-xs">
            Description must be {MAX_LENGTH.toLocaleString()} characters or
            fewer.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!canReset}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSend}
          disabled={!canSend}
        >
          {isSending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            "Send request"
          )}
        </Button>
      </div>

      {networkError && (
        <ErrorAlert
          title="Network error"
          description={networkError}
        />
      )}

      {result && (
        <div
          className="space-y-2"
          role="region"
          aria-live="polite"
          aria-label="API response"
        >
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold",
                statusBadgeClass(result.status),
              )}
            >
              {result.status}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {result.durationMs} ms
            </span>
          </div>
          <Code code={prettyJson(result.body)} lang="json" />
          {result.postId && !deletedPostId && (
            <div className="bg-muted/30 border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-xs">
                A real feedback post was created on your board.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  result.postId &&
                  deletePost.mutate({ postId: result.postId })
                }
                disabled={deletePost.isPending}
              >
                {deletePost.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    Delete test post
                  </>
                )}
              </Button>
            </div>
          )}
          {deletedPostId && (
            <div className="bg-muted/30 border-border flex items-center gap-2 rounded-md border px-3 py-2">
              <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />
              <p className="text-muted-foreground text-xs">
                Test post deleted.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
