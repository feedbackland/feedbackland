import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export const useFeedbackPostsByIds = ({
  ids,
  enabled,
}: {
  ids: string[];
  enabled: boolean;
}) => {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPostsByIds.queryOptions(
    {
      ids,
    },
    {
      enabled: !!(enabled && ids?.length > 0),
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
};
