"use client";

import { Button } from "@/components/ui/button";

export function GetStartedCodeblock({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div>
      <h1>Get started codeblock</h1>
      <div>
        <Button onClick={() => onSuccess()}>Proceed</Button>
      </div>
    </div>
  );
}
