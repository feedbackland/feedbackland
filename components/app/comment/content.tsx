"use client";

import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { useEffect, useState } from "react"; // Import hooks

export function CommentContent({
  content,
  className,
}: {
  content: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const [sanitizedContent, setSanitizedContent] = useState("");

  useEffect(() => {
    // Configure DOMPurify to allow mention-specific attributes on spans
    const clean = DOMPurify.sanitize(content, {
      ADD_TAGS: ["span"], // Ensure span is allowed (usually is by default)
      ADD_ATTR: ["data-id", "data-label", "data-type", "class"], // Allow specific attributes
      // Optionally, enforce class="mention" only on spans with data-type="mention"
      // This requires more complex configuration or post-processing if needed.
    });
    setSanitizedContent(clean);
  }, [content]);

  return (
    <div className={cn("tiptap-output mt-1", className)}>
      {parse(sanitizedContent)}
    </div>
  );
}
