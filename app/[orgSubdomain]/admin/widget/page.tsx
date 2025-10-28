"use client";

import { WidgetDocs } from "@/components/app/widget-docs";
import { useOrg } from "@/hooks/use-org";

export default function AdminWidgetPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org.id) {
    return (
      <div className="">
        <h2 className="h5 mb-0.5">Widget</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Follow the steps below to embed this platform directly in your React
          or Next.js app.
        </p>
        <WidgetDocs
          showTitle={false}
          orgId={org.id}
          orgSubdomain={org.orgSubdomain}
        />
      </div>
    );
  }
}
