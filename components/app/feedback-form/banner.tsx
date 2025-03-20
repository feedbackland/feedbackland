"use client";

import { Button } from "@/components/ui/button";

export function FeedbackFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="text-muted-foreground bg-background hover:bg-background hover:text-muted-foreground hover:ring-ring h-fit w-full justify-start p-3 text-sm leading-5 font-normal hover:ring-1"
    >
      Any feedback? We’d love to hear from you!
    </Button>
  );
}
