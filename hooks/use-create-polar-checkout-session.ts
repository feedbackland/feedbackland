import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useCreatePolarCheckoutSession() {
  const trpc = useTRPC();

  const mutation = useMutation(
    trpc.createPolarCheckoutSession.mutationOptions(),
  );

  return mutation;
}
