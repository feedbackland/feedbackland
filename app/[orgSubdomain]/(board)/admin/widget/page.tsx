"use client";

import { WidgetDocs } from "@/components/app/widget-docs";
import { WidgetDocsLoading } from "@/components/app/widget-docs/loading";
import { useOrg } from "@/hooks/use-org";

export default function AdminWidgetPage() {
  const {
    query: { data: org, isPending },
  } = useOrg();

  return (
    <div>
      <h2 className="h5 mb-6">Widget</h2>
      {isPending ? (
        <WidgetDocsLoading />
      ) : org?.id ? (
        <WidgetDocs orgId={org.id} orgSubdomain={org.orgSubdomain} />
      ) : null}
    </div>
  );
}
