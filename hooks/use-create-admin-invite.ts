import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useCreateAdminInvite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.createAdminInvite.mutationOptions({
      onSuccess: async () => {
        // queryClient.invalidateQueries({
        //   queryKey: trpc.getOrg.queryKey(),
        // });
      },
    }),
  );

  return mutation;
}
