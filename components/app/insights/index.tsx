"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function Insights() {
  const [prompt, setPrompt] = useState(
    "Summarize all feature requests that are under consideration. Rank them based on total number of upvotes.",
  );

  return (
    <div>
      <div className="space-y-2">
        <div>
          <Label>Ask anything about your platform&apos;s data</Label>
          <Textarea placeholder="Type your message here." />
        </div>
        <Button>Submit</Button>
      </div>
    </div>
  );
}
