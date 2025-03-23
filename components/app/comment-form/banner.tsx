"use client";

import { Button } from "@/components/ui/button";

export function CommentFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="text-muted-foreground hover:ring-ring bg-background hover:bg-background hover:text-muted-foreground h-fit w-full cursor-text justify-start rounded-lg p-3 text-sm leading-5 font-normal hover:ring-1"
    >
      Add a comment
    </Button>
  );
}
