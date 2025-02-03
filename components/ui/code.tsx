"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

interface CodeProps {
  code: string;
  language: string;
  showLineNumbers: boolean;
  title?: string;
}

export function Code({ code, language, showLineNumbers, title }: CodeProps) {
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
        // .process(code)
        .process("```" + language + "\n" + code + "\n```");

      setHighlightedCode(String(result));
    }

    highlight();
  }, [code, language, showLineNumbers]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-primary text-gray-100">
      {title && (
        <div className="flex items-center justify-between border-b border-border/20 bg-primary px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-200">{title}</span>
            <span className="text-xs text-gray-400">{language}</span>
          </div>
          <button
            onClick={copyToClipboard}
            className="rounded-md p-1.5 transition-colors hover:bg-[#1f2937]"
            title="Copy code"
          >
            <Copy size={16} className="text-gray-400 hover:text-gray-300" />
          </button>
        </div>
      )}
      <div
        className="overflow-x-auto p-4 text-xs"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
