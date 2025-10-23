"use client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TextSelect } from "lucide-react";

export function FeedbackPostsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TextSelect />
        </EmptyMedia>
        <EmptyTitle>No Feedback Yet</EmptyTitle>
        <EmptyDescription>
          No feedback has been submitted yet. Be the first to share your
          thoughts!
        </EmptyDescription>
      </EmptyHeader>
      {/* <EmptyContent>
        <div className="flex gap-2">
          <Button>Create Project</Button>
          <Button variant="outline">Import Project</Button>
        </div>
      </EmptyContent> */}
    </Empty>
  );
}
