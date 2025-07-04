"use client";

import { useEffect, useState } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function Code({
  code,
  language = "ts",
  showLineNumbers = false,
  className,
}: {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
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
        "border-border relative flex flex-col overflow-hidden rounded-lg border bg-black p-4 shadow-xs",
        className,
      )}
    >
      <CopyButton
        className="hover:bg-muted-foreground/50 absolute! top-1 right-1.5 size-fit bg-black p-2 text-white hover:text-white"
        text={code}
      />

      <div
        className="scrollbar grow overflow-x-auto font-mono text-xs"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
