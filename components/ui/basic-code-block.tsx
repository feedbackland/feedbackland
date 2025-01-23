"use client";

import { CopyButton } from "@/components/ui/copy-button";

export function BasicCodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} className="absolute top-2 right-2" />
      <pre className="bg-primary rounded-lg overflow-x-auto scrollbar p-0 text-xs text-primary-foreground">
        {code}
      </pre>
    </div>
  );
}
