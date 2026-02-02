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
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function highlight() {
      const html = await codeToHtml(code, {
        lang: lang || "tsx",
        theme: resolvedTheme === "dark" ? "github-dark" : "github-light",
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
  }, [code, lang, resolvedTheme]);

  return (
    <div
      className={cn(
        "bg-background border-border relative flex flex-col overflow-hidden rounded-lg border p-3",
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
