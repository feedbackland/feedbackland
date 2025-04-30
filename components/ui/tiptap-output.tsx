"use client";

import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import parse, { Element } from "html-react-parser";
import { memo } from "react";
import Image from "next/image";

function getImageDimensions(
  imageUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = (err: any) => {
      console.error("Failed to load image client-side:", err);
      reject(new Error("Failed to load image to get dimensions"));
    };

    img.src = imageUrl;
  });
}

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
    replace: async (domNode) => {
      if (domNode instanceof Element) {
        if (
          !forbiddenTags.includes("a") &&
          domNode.name === "img" &&
          domNode.attribs
        ) {
          const imageUrl = domNode.attribs.src;
          const { width, height } = await getImageDimensions(imageUrl);

          return (
            <a target="_blank" rel="noopener noreferrer" href={imageUrl}>
              <Image
                src={imageUrl}
                alt="Uploaded user image"
                width={width}
                height={height}
                sizes="100px"
                quality={5}
              />
            </a>
          );
        }
      }

      return undefined;
    },
  });

  return <div className={cn("tiptap-output", className)}>{parsedHtml}</div>;
});
