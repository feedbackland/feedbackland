"use client";

import { cn } from "@/lib/utils";
// import DOMPurify from "dompurify";
import parse, { Element, attributesToProps } from "html-react-parser";
import sanitizeHtml, { defaults as sanitizeHtmlDefaults } from "sanitize-html";
import { memo } from "react"; // Import hooks

export const TiptapOutput = memo(function TiptapOutput({
  content,
  className,
  disallowedTags = [],
}: {
  content: string;
  disallowedTags?: string[];
  className?: React.ComponentProps<"div">["className"];
}) {
  // DOMPurify.sanitize(content)

  return (
    <div className={cn("tiptap-output", className)}>
      {parse(
        sanitizeHtml(content, {
          allowedTags: sanitizeHtmlDefaults.allowedTags.filter(
            (tag) => !disallowedTags.includes(tag),
          ),
          allowedAttributes: {
            ...sanitizeHtmlDefaults.allowedAttributes,
            span: ["data-id", "data-label", "data-type"],
          },
          allowedClasses: {
            span: ["mention"],
          },
        }),
        {
          replace: (domNode) => {
            if (
              domNode instanceof Element &&
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

            return undefined;
          },
        },
      )}
    </div>
  );
});
