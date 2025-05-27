import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useAdminInvite({
  adminInviteToken,
  enabled = true,
}: {
  adminInviteToken: string | null | undefined;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getAdminInvite.queryOptions(
    {
      adminInviteToken: adminInviteToken as string,
    },
    {
      enabled: !!(enabled && adminInviteToken),
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
