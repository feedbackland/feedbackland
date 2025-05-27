import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useRedeemAdminInvite() {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.redeemAdminInvite.mutationOptions());
  return mutation;
}
