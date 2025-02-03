"use client";

import { BasicCodeBlock } from "@/components/ui/basic-code-block";

export function InstallWidget() {
  return (
    <div className=" flex items-center justify-between p-5 border-b border-border">
      <span>Claim this org</span>
      <BasicCodeBlock
        code={`
          import { OverlayWidget } from "feedbackland/react";

          function App() {
            return (
              <div>
                 <Button onClick={() => setIsOpen(true)}>Feedback</Button>
                 <SlideInWidget 
                  id=”12323-2323-2323”
                  open={isOpen}
                  onClose={() => setIsOpen(false)}
                  mode=”light” // can be either “light”, “dark” or “system”
                  />
              </div>
            );
          }
      `}
      />
    </div>
  );
}
