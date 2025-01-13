"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const CodeBlock = ({
  code,
  language,
}: {
  code: string;
  language: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  return (
    <div className="relative w-full rounded-md bg-zinc-950/90">
      <div className="absolute top-2 right-2 z-10">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className={cn(isCopied && "bg-green-500 hover:bg-green-600")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </Button>
      </div>
      <Highlight code={code} language={language} theme={themes.palenight}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              "p-0 overflow-x-auto rounded-md bg-primary text-sm",
              className
            )}
            // style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="bg-primary">
                {/* <span>{i + 1}</span> */}
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};
