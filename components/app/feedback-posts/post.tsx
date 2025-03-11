"use client";

import { memo } from "react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import {
  ArrowBigUp,
  ArrowUp,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  Triangle,
} from "lucide-react";

function InnerFeedbackPost({
  title,
  description,
  category,
  authorName,
  createdAt,
}: {
  title: string;
  description: string;
  category: string;
  authorName: string;
  createdAt: Date;
}) {
  return (
    <div className="">
      <div className="flex justify-between">
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="text-sm font-normal text-muted-foreground">
            {category} • {timeAgo.format(createdAt, "twitter")}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <MessageSquare className="!size-4" />0
          </Button>
          <Button variant="ghost" size="sm">
            <ThumbsUp className="!size-4" />0
          </Button>
        </div>
      </div>
      <div className="mt-2">{parse(DOMPurify.sanitize(description))}</div>
    </div>
  );
}

export const FeedbackPost = memo(InnerFeedbackPost);
