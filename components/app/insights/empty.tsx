import { ArrowUpRightIcon, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function InsightsEmpty() {
  return (
    <Empty className="border-border border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardList />
        </EmptyMedia>
        <EmptyTitle>No AI Roadmap found</EmptyTitle>
        <EmptyDescription>
          Click 'Generate' to create your first AI Roadmap
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
