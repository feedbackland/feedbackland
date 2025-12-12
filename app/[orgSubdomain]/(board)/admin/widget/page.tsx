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
        <h2 className="h5 mb-6">Widget</h2>
        {/* <p className="mb-6 text-sm">
          Collect feedback directly in your React or Next.js app.
        </p> */}
        <WidgetDocs orgId={org.id} orgSubdomain={org.orgSubdomain} />
      </div>
    );
  }
}
