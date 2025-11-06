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
    <Empty className="md:border-2 md:border-dashed md:py-[117px]!">
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
    </Empty>
  );
}
