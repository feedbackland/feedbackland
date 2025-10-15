"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { feedbackPostsStateAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";

export default function FeedbackPostsSidebarFilter({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [feedbackPostsState, setFeedbackPostsState] = useAtom(
    feedbackPostsStateAtom,
  );

  const handleFilterBy = (
    status:
      | "under consideration"
      | "planned"
      | "in progress"
      | "done"
      | "declined"
      | null,
  ) => {
    setFeedbackPostsState((prev) => ({
      ...prev,
      status,
    }));
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <Label className="text-muted-foreground mb-1">Status</Label>
      <Button
        onClick={() => handleFilterBy(null)}
        size="sm"
        variant={feedbackPostsState?.status === null ? "secondary" : "ghost"}
        className="justify-start"
      >
        All
      </Button>
      <Button
        onClick={() => handleFilterBy("under consideration")}
        size="sm"
        variant={
          feedbackPostsState?.status === "under consideration"
            ? "secondary"
            : "ghost"
        }
        className="text-under-consideration! justify-start"
      >
        Under consideration
      </Button>
      <Button
        onClick={() => handleFilterBy("planned")}
        size="sm"
        variant={
          feedbackPostsState?.status === "planned" ? "secondary" : "ghost"
        }
        className="text-planned! justify-start"
      >
        Planned
      </Button>
      <Button
        onClick={() => handleFilterBy("in progress")}
        size="sm"
        variant={
          feedbackPostsState?.status === "in progress" ? "secondary" : "ghost"
        }
        className="text-in-progress! justify-start"
      >
        In progress
      </Button>
      <Button
        onClick={() => handleFilterBy("done")}
        size="sm"
        variant={feedbackPostsState?.status === "done" ? "secondary" : "ghost"}
        className="text-done! justify-start"
      >
        Done
      </Button>
      <Button
        onClick={() => handleFilterBy("declined")}
        size="sm"
        variant={
          feedbackPostsState?.status === "declined" ? "secondary" : "ghost"
        }
        className="text-declined! justify-start"
      >
        Declined
      </Button>
    </div>
  );
}
