"use client";
import { cn } from "@/lib/utils";
import { isStatusLabel, STATUS_LABELS } from "@/lib/feedback-status";
import DOMPurify from "dompurify";
import parse, {
  domToReact,
  Element,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
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
  const sanitized = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: forbiddenAttr,
  });
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!(node instanceof Element)) return;
      if (node.name === "span" && node.attribs["data-type"] === "status") {
        const status = node.attribs["data-label"];
        if (!status)
          return <>{domToReact(node.children as DOMNode[], options)}</>;
        return isStatusLabel(status) ? (
          <span className={`text-${status}`}>{STATUS_LABELS[status]}</span>
        ) : (
          <>{status}</>
        );
      }
      if (node.name === "a")
        return (
          <a
            href={node.attribs.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {domToReact(node.children as DOMNode[], options)}
          </a>
        );
      if (node.name === "img") {
        const src = node.attribs.src;
        if (!src) return <></>;
        const width = Number(node.attribs.width),
          height = Number(node.attribs.height);
        const image =
          Number.isFinite(width) &&
          width > 0 &&
          Number.isFinite(height) &&
          height > 0 ? (
            <Image
              src={src}
              alt={node.attribs.alt ?? "Uploaded image"}
              width={width}
              height={height}
              className="max-w-full"
            />
          ) : (
            <img
              src={src}
              alt={node.attribs.alt ?? "Uploaded image"}
              className="max-w-full"
            />
          );
        return forbiddenTags.includes("a") ? (
          image
        ) : (
          <a href={src} target="_blank" rel="noopener noreferrer nofollow">
            {image}
          </a>
        );
      }
    },
  };
  return (
    <div className={cn("tiptap-output", className)}>
      {parse(sanitized, options)}
    </div>
  );
});
