"use client";

import { WidgetDocsContent } from "@/components/app/widget-docs/content";
import { useOrg } from "@/hooks/use-org";

export default function AdminWidgetPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org.id) {
    return <WidgetDocsContent orgId={org.id} />;
  }
}
