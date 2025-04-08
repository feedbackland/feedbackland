"use client";

import { Input } from "@/components/ui/input";

export function FeedbackFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Input
      onClick={onClick}
      onFocus={onClick}
      className="h-fit w-full justify-start rounded-lg p-3 text-sm leading-5 font-normal"
      placeholder={`Share your feedback. For example an idea for an improvement, a bug report, or anything else...`}
    />
  );
}
