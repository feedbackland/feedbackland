"use client";

import { WidgetDocs } from "@/components/app/widget-docs";
import { useOrg } from "@/hooks/use-org";

export default function AdminWidgetPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org.id) {
    return (
      <div>
        <h2 className="h4 mb-4">Widget</h2>
        <p className="text-muted-foreground mb-6 text-base">
          Follow these steps to embed the platform in your React app and start
          collecting in-app feedback.
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
