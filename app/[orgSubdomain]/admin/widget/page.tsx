"use client";

import { WidgetDocs } from "@/components/app/widget-docs";
import { useOrg } from "@/hooks/use-org";

export default function AdminWidgetPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org.id) {
    return (
      <div className="space-y-5">
        <h2 className="h5">Widget</h2>
        {/* <p className="">Embed the widget in your React app</p> */}
        <WidgetDocs
          showTitle={false}
          orgId={org.id}
          orgSubdomain={org.orgSubdomain}
        />
      </div>
    );
  }
}
