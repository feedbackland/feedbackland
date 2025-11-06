"use client";

import { ArrowUpRightIcon, ClipboardList } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function InsightsEmpty() {
  return (
    <Empty className="border-2 border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardList />
        </EmptyMedia>
        <EmptyTitle>No AI Roadmap</EmptyTitle>
        <EmptyDescription>
          Click 'Generate' to create your first AI Roadmap
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
