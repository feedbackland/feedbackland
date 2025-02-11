"use client";

import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WidgetDocsContent } from "@/components/app/widget-docs/content";

export function ClaimOrgSuccess({ orgId }: { orgId: string }) {
  return (
    <DialogContent className="sm:max-w-[700px]">
      <DialogHeader className="mb-3 mt-2">
        <DialogTitle className="h3 text-center">Congratulations!</DialogTitle>
        <DialogDescription className="text-center">
          You&apos;ve successfully claimed this platofrm and are now its owner!
        </DialogDescription>
      </DialogHeader>
      <WidgetDocsContent orgId={orgId} />
    </DialogContent>
  );
}
