"use client";

import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import parse, { Element } from "html-react-parser";
import { memo } from "react";
import Image from "next/image";

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
          const imageUrl = domNode.attribs.src;
          const width = Number(domNode.attribs.width);
          const height = Number(domNode.attribs.height);

          return (
            <a target="_blank" rel="noopener noreferrer" href={imageUrl}>
              <Image
                src={imageUrl}
                alt="Uploaded user image"
                width={width}
                height={height}
                quality={1}
                className="w-full"
              />
            </a>
          );

          // return (
          //   <a target="_blank" rel="noopener noreferrer" href={imageUrl}>
          //     <img src={imageUrl} alt="User-uploaded image" />
          //   </a>
          // );
        }
      }

      return undefined;
    },
  });

  return <div className={cn("tiptap-output", className)}>{parsedHtml}</div>;
});
