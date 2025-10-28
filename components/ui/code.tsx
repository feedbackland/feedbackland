"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";
import { useTheme } from "next-themes";

export function Code({
  code,
  className,
  lang,
}: {
  code: string;
  className?: React.ComponentProps<"div">["className"];
  lang?: string;
}) {
  const [highlightedCode, setHighlightedCode] = useState(code);
  const { theme } = useTheme();

  useEffect(() => {
    async function highlight() {
      const html = await codeToHtml(code, {
        lang: lang || "tsx",
        theme: theme === "dark" ? "github-dark" : "github-light",
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
  }, [code, lang, theme]);

  return (
    <div
      className={cn(
        "bg-muted/50 border-border relative flex flex-col overflow-hidden rounded-lg border p-3 shadow-xs",
        className,
      )}
    >
      <CopyButton
        className="absolute! top-1.5 right-1.5 size-fit p-2"
        text={code}
      />
      <div
        className="scrollbar grow overflow-x-auto font-mono text-sm"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
