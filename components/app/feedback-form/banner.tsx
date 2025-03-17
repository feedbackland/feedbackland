"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeedbackFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-fit w-full justify-start p-3 text-sm font-normal leading-5 text-muted-foreground hover:bg-background hover:text-muted-foreground hover:ring-1 hover:ring-ring"
    >
      Share your feedback
    </Button>
  );
}
