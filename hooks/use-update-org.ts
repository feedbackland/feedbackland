import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUpdateOrg() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.updateOrg.mutationOptions({
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getOrg.queryKey(),
        });
      },
    }),
  );

  return mutation;
}
