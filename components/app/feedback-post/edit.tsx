"use client";

import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { FeedbackPostUpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { GoBackButton } from "./go-back-button";
import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackPostOptionsMenu } from "./options-menu";
import { Tiptap } from "@/components/ui/tiptap";

export function FeedbackPostEdit({
  postId,
  className,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data },
  } = useFeedbackPost({ postId });

  return <div className="">{/* <Tiptap /> */}</div>;
}
