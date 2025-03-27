"use client";

import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import parse from "html-react-parser";

export function CommentContent({
  content,
  className,
}: {
  content: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("tiptap-output mt-0.5", className)}>
      {parse(DOMPurify.sanitize(content))}
    </div>
  );
}
