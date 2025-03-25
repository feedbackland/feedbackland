"use client";

import { Input } from "@/components/ui/input";

export function FeedbackFormBanner({ onClick }: { onClick: () => void }) {
  return (
    <Input
      onClick={onClick}
      onFocus={onClick}
      className="h-fit w-full justify-start rounded-lg p-3 text-sm leading-5 font-normal"
      placeholder={`Add your feature request, bug report, or any other feedback…`}
    />
  );
}
