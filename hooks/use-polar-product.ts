import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function usePolarProduct({ productId }: { productId: string | null }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getPolarProduct.queryOptions(
    { productId: productId as string },
    { enabled: !!productId },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
