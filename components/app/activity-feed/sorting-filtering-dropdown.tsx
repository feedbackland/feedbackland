"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { capitalizeFirstLetter, cn } from "@/lib/utils";

export function ActivityFeedSortingFilteringDropdown({
  orderBy,
  status,
  onChange,
}: {
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  onChange: ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) => void;
}) {
  const getDropdownName = () => {
    let orderByName = "Newest";

    if (orderBy === "upvotes") {
      orderByName = "Most upvoted";
    } else if (orderBy === "comments") {
      orderByName = "Most commented";
    }

    return (
      <>
        {orderByName}
        {status && ", "}
        {status && (
          <div className={cn(`text-${status.replace(" ", "-")}`)}>
            {capitalizeFirstLetter(status)}
          </div>
        )}
      </>
    );
  };

  const handleSelectOrderBy = (value: FeedbackOrderBy) => {
    onChange({ orderBy: value, status });
  };

  const handleSelectStatus = (value: FeedbackStatus) => {
    onChange({ orderBy, status: value });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          className="text-muted-foreground hover:text-primary h-auto p-0 hover:no-underline"
        >
          {getDropdownName()}
          <ChevronDown className="size-3.5!" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={orderBy}
          onValueChange={(value) =>
            handleSelectOrderBy(value as FeedbackOrderBy)
          }
        >
          <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="upvotes">
            Most upvoted
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comments">
            Most commented
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuRadioGroup
          value={status ? status : "all"}
          onValueChange={(value) => {
            handleSelectStatus(
              (value !== "all" ? value : null) as FeedbackStatus,
            );
          }}
        >
          <DropdownMenuRadioItem value="all">
            All statuses
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="under consideration"
            className="text-under-consideration"
          >
            Under consideration
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="planned" className="text-planned">
            Planned
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="in progress"
            className="text-in-progress"
          >
            In progress
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="done" className="text-done">
            Done
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="declined" className="text-declined">
            Declined
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
