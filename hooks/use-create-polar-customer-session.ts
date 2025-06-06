import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useCreatePolarCustomerSession() {
  const trpc = useTRPC();

  const mutation = useMutation(
    trpc.createPolarCustomerSession.mutationOptions(),
  );

  return mutation;
}
