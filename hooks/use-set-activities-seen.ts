import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSetActivitiesSeen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.setActivitiesSeen.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.refetchQueries({
          queryKey: trpc.getActivityFeedMetaData.queryKey(),
        });
      },
    }),
  );

  return mutation;
}
