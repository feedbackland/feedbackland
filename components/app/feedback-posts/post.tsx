"use client";

import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";

export function FeedbackPost({
  title,
  description,
  authorId,
  authorName,
  createdAt,
}: {
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}) {
  return (
    <div className="">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="mt-1 text-sm text-gray-500">
        By {authorName} • {timeAgo.format(createdAt)}
      </div>
      <div className="mt-2">{parse(DOMPurify.sanitize(description))}</div>
    </div>
  );
}
