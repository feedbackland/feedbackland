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
      async onSuccess() {
        await cache.invalidateQueries({
          queryKey: trpc.getSettings.queryKey(),
        });
        router.refresh();
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("feedbackland-settings");
          channel.postMessage("refresh");
          channel.close();
        }
      },
    }),
  );
}
