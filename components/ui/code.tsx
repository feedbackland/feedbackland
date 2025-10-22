"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";

export function Code({
  code,
  className,
}: {
  code: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const [highlightedCode, setHighlightedCode] = useState(code);

  useEffect(() => {
    async function highlight() {
      const html = await codeToHtml(code, {
        lang: "tsx",
        theme: "github-dark",
        transformers: [
          {
            pre(node) {
              // remove background style
              delete node.properties.style;
            },
          },
        ],
      });

      setHighlightedCode(html);
    }

    highlight();
  }, [code]);

  return (
    <div
      className={cn(
        "border-border relative flex flex-col overflow-hidden rounded-lg border bg-black p-4 shadow-xs",
        className,
      )}
    >
      <CopyButton
        className="hover:bg-muted-foreground/50 absolute! top-2.5 right-2 size-fit p-2 text-white hover:text-white"
        text={code}
      />
      <div
        className="scrollbar grow overflow-x-auto font-mono text-xs"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
