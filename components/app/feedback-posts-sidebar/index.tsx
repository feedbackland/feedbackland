"use client";

import { cn } from "@/lib/utils";
import { FeedbackPostsSidebarSearch } from "./search";
import FeedbackPostsSidebarFilter from "./filter";
import FeedbackPostsSidebarOrder from "./order";
import { useWindowSize } from "react-use";

export default function FeedbackPostsSidebar({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { width } = useWindowSize();

  if (width >= 768) {
    return (
      <div
        className={cn(
          "border-border bg-background sticky top-7 flex w-[260px] flex-col items-stretch space-y-7 rounded-md border p-5 shadow-xs",
          className,
        )}
      >
        <FeedbackPostsSidebarSearch />
        <FeedbackPostsSidebarOrder />
        <FeedbackPostsSidebarFilter />
      </div>
    );
  }
}
