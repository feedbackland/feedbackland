import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { useSubdomain } from "@/hooks/useSubdomain";

export function useOrg() {
  const trpc = useTRPC();
  const subdomain = useSubdomain();

  const { data: org } = useQuery(
    trpc.getOrg.queryOptions(
      { orgSubdomain: subdomain as string },
      { enabled: !!subdomain },
    ),
  );

  return org;
}
