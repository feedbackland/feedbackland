"use client";

import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import parse, { Element, attributesToProps } from "html-react-parser";
import { memo } from "react";

export const TiptapOutput = memo(function TiptapOutput({
  content,
  className,
  forbiddenTags = [],
  forbiddenAttr = [],
}: {
  content: string;
  forbiddenTags?: string[];
  forbiddenAttr?: string[];
  className?: React.ComponentProps<"div">["className"];
}) {
  const sanitizedHtml = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: forbiddenAttr,
  });

  const parsedHtml = parse(sanitizedHtml, {
    replace: (domNode) => {
      if (domNode instanceof Element) {
        if (
          !forbiddenTags.includes("a") &&
          domNode.name === "img" &&
          domNode.attribs
        ) {
          const imgProps = attributesToProps(domNode.attribs);
          const imgElement = <img {...imgProps} />;

          return (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={domNode.attribs.src}
            >
              {imgElement}
            </a>
          );
        }
      }

      return undefined;
    },
  });

  return <div className={cn("tiptap-output", className)}>{parsedHtml}</div>;
});
