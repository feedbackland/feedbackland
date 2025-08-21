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
        <h2 className="h4 mb-4">Embed the widget in your React app</h2>
        <WidgetDocs
          showTitle={false}
          orgId={org.id}
          orgSubdomain={org.orgSubdomain}
        />
      </div>
    );
  }
}
