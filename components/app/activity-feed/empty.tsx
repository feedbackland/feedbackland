"use client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { CheckCheck, Inbox, SearchX } from "lucide-react";

export type ActivityEmptyVariant =
  | "platform"
  | "caught-up"
  | "search"
  | "filter";

export function ActivityFeedEmpty({
  variant,
  onReset,
}: {
  variant: ActivityEmptyVariant;
  onReset?: () => void;
}) {
  const config = {
    platform: {
      icon: <Inbox />,
      title: "No activity yet",
      description:
        "Feedback and comments from your users will show up here as they come in.",
      actionLabel: null as string | null,
    },
    "caught-up": {
      icon: <CheckCheck />,
      title: "You're all caught up",
      description: "There's nothing new to review right now.",
      actionLabel: "Show all activity",
    },
    search: {
      icon: <SearchX />,
      title: "No matches found",
      description: "No activity matches your search.",
      actionLabel: "Clear search",
    },
    filter: {
      icon: <SearchX />,
      title: "Nothing here",
      description: "No activity matches the current filters.",
      actionLabel: "Reset filters",
    },
  }[variant];

  return (
    <Empty className="border-0 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">{config.icon}</EmptyMedia>
        <EmptyTitle>{config.title}</EmptyTitle>
        <EmptyDescription>{config.description}</EmptyDescription>
      </EmptyHeader>
      {config.actionLabel && onReset && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onReset}>
            {config.actionLabel}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
