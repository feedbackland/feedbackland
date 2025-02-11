"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { WidgetDocsContent } from "@/components/app/widget-docs/content";

export function ClaimOrgSuccessDialog({
  open,
  orgId,
  onClose,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          router.refresh();
          onClose();
        }
      }}
    >
      <DialogContent className="w-full max-w-[700px]">
        <DialogHeader className="mb-3 mt-2">
          <DialogTitle className="h3 text-center">Congratulations!</DialogTitle>
          <DialogDescription className="text-center">
            You&apos;ve successfully claimed ownership of this platform!
          </DialogDescription>
        </DialogHeader>
        <WidgetDocsContent orgId={orgId} />
      </DialogContent>
    </Dialog>
  );
}
