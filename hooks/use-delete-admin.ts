import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useDeleteAdmin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.deleteAdmin.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getAdmins.queryKey(),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getAdminLimit.queryKey(),
        });
      },
    }),
  );

  return mutation;
}
