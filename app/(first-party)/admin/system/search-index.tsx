"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const descriptions: Record<string, string> = {
  off: "Exact text search is available.",
  verified: "Semantic search is available.",
  unverified: "Waiting for the embedding provider.",
  "rebuild-required": "Rebuild the index to use the configured model or width.",
  "column-mismatch":
    "The two search columns have inconsistent types or dimensions.",
  "provider-width-mismatch": "The provider returned a different vector width.",
  "profile-context-length":
    "The provider rejected an input inside the tokenizer limit.",
  UNSUPPORTED_EMBEDDING_TOKENIZER:
    "Choose a supported embedding model before rebuilding.",
};
export function SearchIndex() {
  const trpc = useTRPC(),
    query = useQuery(
      trpc.getSearchIndex.queryOptions(undefined, { refetchInterval: 5000 }),
    );
  const [width, setWidth] = useState<string | null>(null),
    [preview, setPreview] = useState<{
      epoch: string;
      token: string;
      dimensions: number;
      total: number;
    } | null>(null);
  const mutation = useMutation(
    trpc.rebuildSearchIndex.mutationOptions({
      onSuccess: async () => {
        setPreview(null);
        setWidth(null);
        await query.refetch();
      },
    }),
  );
  const data = query.data,
    n = Number(data?.requested ?? width ?? data?.dimensions);
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Search index</h2>
      {query.isError && <p role="alert">Could not read the search index.</p>}
      {data && (
        <>
          <p>
            {descriptions[data.state] ??
              "The embedding provider is unavailable. Exact search is available."}{" "}
            {data.model} · {data.dimensions ?? "unknown"} dimensions
            {data.observed !== null && ` · provider returned ${data.observed}`}.
          </p>
          <p>
            {data.total - data.pending - data.skipped} indexed · {data.pending}{" "}
            pending · {data.skipped} skipped
          </p>
          <label className="block" htmlFor="index-width">
            Rebuild at dimensions
          </label>
          <Input
            id="index-width"
            type="number"
            min={1}
            max={4000}
            value={data.requested ?? width ?? data.dimensions ?? ""}
            disabled={data.requested !== null || mutation.isPending}
            onChange={(e) => {
              setWidth(e.target.value);
              setPreview(null);
            }}
          />
          {preview ? (
            <div
              className="space-y-2"
              role="group"
              aria-label="Confirm index rebuild"
            >
              <p>
                Clear the index for {preview.total} items and rebuild at{" "}
                {preview.dimensions} dimensions. Allow at least{" "}
                {Math.ceil(preview.total / 64)} batches. The daily shared
                allowance for this work is {data.dailyBudget} calls. Writes may
                wait while the database rebuilds its indexes.
              </p>
              <Button
                disabled={
                  mutation.isPending ||
                  data.epoch !== preview.epoch ||
                  data.token !== preview.token
                }
                onClick={() => mutation.mutate({ ...preview, confirm: true })}
              >
                Confirm rebuild
              </Button>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={
                !Number.isInteger(n) ||
                n < 1 ||
                n > 4000 ||
                data.state === "UNSUPPORTED_EMBEDDING_TOKENIZER" ||
                data.model === "none"
              }
              onClick={() => {
                mutation.reset();
                setPreview({
                  epoch: data.epoch,
                  token: data.token,
                  total: data.total,
                  dimensions: n,
                });
              }}
            >
              Rebuild search index
            </Button>
          )}
          {mutation.isError && (
            <p role="alert">
              The rebuild did not complete. Refresh the index status and try
              again.
            </p>
          )}
          {mutation.isSuccess && (
            <p role="status">
              Index rebuild committed. Eligible items will be indexed in the
              background.
            </p>
          )}
        </>
      )}
    </section>
  );
}
