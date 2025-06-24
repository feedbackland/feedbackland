import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { useAuth } from "@/hooks/use-auth";

export function useUpdateUser() {
  const { refreshSession } = useAuth();
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.updateUser.mutationOptions({
      onSettled: async () => {
        await refreshSession();
      },
    }),
  );
  return mutation;
}
