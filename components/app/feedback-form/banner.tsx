"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export function FeedbackFormBanner({
  bannerText,
  buttonText,
  onClick,
}: {
  bannerText: string;
  buttonText: string;
  onClick: () => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-colors ease-out hover:border hover:border-primary"
      onClick={onClick}
    >
      <span className="text-sm text-foreground">{bannerText}</span>
      <Button size="sm">
        <PlusIcon className="size-4" />
        {buttonText}
      </Button>
    </div>
  );
}
