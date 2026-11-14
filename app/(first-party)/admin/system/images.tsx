"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
export function ImageStorage() {
  const trpc = useTRPC(),
    usage = useQuery(trpc.getImageUsage.queryOptions());
  const [preview, setPreview] = useState<{
    pendingBytes: string;
    pendingCount: string;
  } | null>(null);
  const reclaim = useMutation(
    trpc.reclaimPendingImages.mutationOptions({
      onSuccess: async () => {
        setPreview(null);
        await usage.refetch();
      },
    }),
  );
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Image storage</h2>
      {usage.data && (
        <p>
          {usage.data.totalBytes} bytes stored. {usage.data.pendingBytes} bytes
          in {usage.data.pendingCount} unattached images.
        </p>
      )}
      {!preview ? (
        <Button
          variant="outline"
          disabled={!usage.data || usage.isFetching}
          onClick={async () => {
            const latest = await usage.refetch();
            if (latest.isSuccess) setPreview(latest.data);
          }}
        >
          Reclaim unattached uploads
        </Button>
      ) : (
        <>
          <p role="status">
            {preview.pendingCount} unattached images ({preview.pendingBytes}{" "}
            bytes) at preview. Confirming removes currently unattached images,
            including attachments in unsent drafts. Authors will need to
            re-attach them.
          </p>
          <Button
            disabled={reclaim.isPending}
            onClick={() => reclaim.mutate({ confirm: true })}
          >
            Confirm reclaim
          </Button>
          <Button
            variant="outline"
            disabled={reclaim.isPending}
            onClick={() => setPreview(null)}
          >
            Cancel
          </Button>
        </>
      )}
      {(usage.isError || reclaim.isError) && (
        <p role="alert">
          Could not access image storage. Check your administrator session and
          try again.
        </p>
      )}
      {reclaim.isSuccess && !preview && (
        <p role="status">Unattached uploads reclaimed.</p>
      )}
    </section>
  );
}
