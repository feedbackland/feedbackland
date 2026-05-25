"use client";

import { ApiDocs } from "@/components/app/api-docs";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrg } from "@/hooks/use-org";

export default function AdminApiPage() {
  const {
    query: { data: org, isPending },
  } = useOrg();

  return (
    <div>
      <h2 className="h5 mb-6">API</h2>
      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : org?.id ? (
        <ApiDocs orgId={org.id} />
      ) : null}
    </div>
  );
}
