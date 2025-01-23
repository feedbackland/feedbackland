"use client";

import { Button } from "@/components/ui/button";
// import { Code } from "@/components/ui/code";

export function GetStartedCodeblock({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div>
      <h1>Get started codeblock</h1>
      {/* <Code code="`const numbers = [1, 2, 3]{:js}`" /> */}
      <div>
        <Button onClick={() => onSuccess()}>Proceed</Button>
      </div>
    </div>
  );
}
