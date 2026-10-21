"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/providers/trpc-client";
export function useUpdateSettings() {
  const trpc = useTRPC(),
    router = useRouter();
  return useMutation(
    trpc.updateSettings.mutationOptions({
      onSuccess() {
        router.refresh();
        const channel = new BroadcastChannel("feedbackland-settings");
        channel.postMessage("refresh");
        channel.close();
      },
    }),
  );
}
