import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUpdateUser() {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.updateUser.mutationOptions());
  return mutation;
}
