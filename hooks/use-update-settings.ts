"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/providers/trpc-client";
export function useUpdateSettings() {
  const trpc = useTRPC(),
    router = useRouter(),
    cache = useQueryClient();
  return useMutation(
    trpc.updateSettings.mutationOptions({
      async onSuccess(saved) {
        const queryKey = trpc.getSettings.queryKey();
        // An older in-flight read must not replace the committed snapshot.
        await cache.cancelQueries({ queryKey });
        cache.setQueryData(queryKey, (current) =>
          !current || BigInt(saved.revision) >= BigInt(current.revision)
            ? saved
            : current,
        );
        await cache.invalidateQueries({
          queryKey,
        });
        router.refresh();
        if (typeof BroadcastChannel !== "undefined") {
          try {
            const channel = new BroadcastChannel("feedbackland-settings");
            try {
              channel.postMessage("refresh");
            } finally {
              channel.close();
            }
          } catch {
            // Polling and router refresh still update public settings.
          }
        }
      },
      async onError(error) {
        if (error.data?.code === "CONFLICT")
          await cache.invalidateQueries({
            queryKey: trpc.getSettings.queryKey(),
          });
      },
    }),
  );
}
