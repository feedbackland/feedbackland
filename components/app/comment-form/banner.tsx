"use client";

import { Input } from "@/components/ui/input";

export function CommentFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Input
      onClick={onClick}
      onFocus={onClick}
      className="h-fit w-full justify-start rounded-lg p-3 text-sm leading-5 font-normal"
      placeholder={`Add a comment`}
    />
  );
}
