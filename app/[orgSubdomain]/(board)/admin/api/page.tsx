"use client";

import { ApiDocs } from "@/components/app/api-docs";
import { ApiDocsLoading } from "@/components/app/api-docs/loading";
import { useOrg } from "@/hooks/use-org";

export default function AdminApiPage() {
  const {
    query: { data: org, isPending },
  } = useOrg();

  return (
    <div>
      <h2 className="h5 mb-6">API</h2>
      {isPending ? (
        <ApiDocsLoading />
      ) : org?.id ? (
        <ApiDocs orgId={org.id} />
      ) : null}
    </div>
  );
}
