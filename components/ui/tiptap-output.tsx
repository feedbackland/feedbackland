"use client";

import { capitalizeFirstLetter, cn } from "@/lib/utils";
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
  console.log("content", content);

  const sanitizedHtml = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: forbiddenAttr,
  });

  console.log("sanitizedHtml", sanitizedHtml);

  const parsedHtml = parse(sanitizedHtml, {
    replace: (domNode) => {
      if (domNode instanceof Element) {
        if (
          !forbiddenTags.includes("span") &&
          domNode.name === "span" &&
          domNode.attribs &&
          domNode.attribs?.["data-type"] === "status" &&
          domNode.attribs?.["data-label"]
        ) {
          const status = domNode.attribs?.["data-label"];
          const statusLabel = capitalizeFirstLetter(
            domNode.attribs?.["data-label"].replace("-", " "),
          );

          return <span className={`text-${status}`}>{statusLabel}</span>;
        }

        // if (
        //   !forbiddenTags.includes("span") &&
        //   domNode.name === "span" &&
        //   domNode.attribs &&
        //   domNode.attribs?.["data-type"] === "mention" &&
        //   domNode.attribs?.["data-label"]
        // ) {
        //   const mentionName = domNode.attribs?.["data-label"];
        //   return (
        //     <span className="bg-primary/10 rounded-md box-decoration-clone px-1.5 py-1 font-semibold">
        //       {`@${mentionName}`}
        //     </span>
        //   );
        // }

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
              {/* <img
                src={imageUrl}
                alt="Uploaded user image"
                width={width}
                height={height}
                alt="User-uploaded image"
              /> */}

              <Image
                src={imageUrl}
                alt="Uploaded user image"
                width={width}
                height={height}
                // quality={10}
                className="max-w-full"
              />
            </a>
          );
        }
      }

      return undefined;
    },
  });

  console.log("parsedHtml", parsedHtml);

  return <div className={cn("tiptap-output", className)}>{parsedHtml}</div>;
});
