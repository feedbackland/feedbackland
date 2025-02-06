"use client";

import { useEffect, useState } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

interface CodeProps {
  code: string;
  language: string;
  showLineNumbers: boolean;
  title?: string;
  className?: React.ComponentProps<"div">["className"];
}

export function Code({
  code,
  language,
  showLineNumbers,
  title,
  className,
}: CodeProps) {
  const [highlightedCode, setHighlightedCode] = useState("");

  useEffect(() => {
    async function highlight() {
      const result = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypePrettyCode, {
          keepBackground: false,
          theme: "poimandres",
          defaultLang: language,
        })
        .use(rehypeStringify)
        .process("```" + language + "\n" + code + "\n```");

      setHighlightedCode(String(result));
    }

    highlight();
  }, [code, language, showLineNumbers]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-primary text-gray-100",
        className,
      )}
    >
      <CopyButton
        className={cn("absolute right-1.5", title ? "top-1.5" : "top-3")}
        text={code}
      />
      {title && (
        <div className="flex items-center justify-between border-b border-border/20 bg-primary px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-200">{title}</span>
          </div>
        </div>
      )}
      <div
        className="overflow-x-auto p-4 text-xs"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
