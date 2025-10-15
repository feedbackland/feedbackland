"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { feedbackPostsStateAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";

export default function FeedbackPostsSidebarOrder({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [feedbackPostsState, setFeedbackPostsState] = useAtom(
    feedbackPostsStateAtom,
  );

  const handleOrderBy = (orderBy: "newest" | "upvotes" | "comments") => {
    setFeedbackPostsState((prev) => ({
      ...prev,
      orderBy,
    }));
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <Label className="text-muted-foreground mb-1">Order by</Label>
      <Button
        onClick={() => handleOrderBy("newest")}
        size="sm"
        variant={
          feedbackPostsState?.orderBy === "newest" ? "secondary" : "ghost"
        }
        className="justify-start"
      >
        Newest
      </Button>
      <Button
        onClick={() => handleOrderBy("upvotes")}
        size="sm"
        variant={
          feedbackPostsState?.orderBy === "upvotes" ? "secondary" : "ghost"
        }
        className="justify-start"
      >
        Most upvoted
      </Button>
      <Button
        onClick={() => handleOrderBy("comments")}
        size="sm"
        variant={
          feedbackPostsState?.orderBy === "comments" ? "secondary" : "ghost"
        }
        className="justify-start"
      >
        Most commented
      </Button>
    </div>
  );
}
