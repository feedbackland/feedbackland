"use client";

import { ActivityFeedItem, FeedbackStatus } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { ArrowBigUpIcon, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useUpdateStatus } from "@/hooks/use-update-status";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  const updateStatus = useUpdateStatus({ postId: item.postId });

  const changeStatus = (status: FeedbackStatus) => {
    setPostStatus(status);

    updateStatus.mutate(
      {
        postId: item.postId,
        status: status,
      },
      {
        onSettled: (updatedPost) => {
          setPostStatus(updatedPost ? updatedPost.status : item.status);
        },
      },
    );
  };

  const [postStatus, setPostStatus] = useState<FeedbackStatus | null>(
    item?.status,
  );

  const statuses: FeedbackStatus[] = [
    "under consideration",
    "planned",
    "in progress",
    "done",
    "declined",
  ];

  return (
    <div className={cn("group", className)}>
      <div className="flex w-full flex-1 flex-col items-stretch space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h3
              className={cn(
                "text-base font-medium group-hover:underline",
                !item.isSeen && "font-bold",
              )}
            >
              {item.title}
            </h3>

            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-normal">
              {item.category && (
                <>
                  <span>{capitalizeFirstLetter(item.category)}</span>
                  <span className="text-[8px]">•</span>
                </>
              )}
              <span className="">{timeAgo.format(item.createdAt)}</span>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-0.5">
                <ArrowBigUpIcon className="size-4!" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
                  {item.upvotes || 0}
                </span>
              </div>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-0.5">
                <MessageSquare className="mr-0.5 ml-0.5 size-3!" />
                <span className="text-muted-foreground text-xs">
                  {item.commentCount}
                </span>
              </div>
            </div>
          </div>
          {/* <FeedbackPostOptionsMenu postId={item.postId} /> */}
        </div>

        <TiptapOutput
          content={item.content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn(
            "text-muted-foreground! line-clamp-4",
            !item.isSeen && "font-bold!",
          )}
        />

        <div className="-ml-0.5 flex w-full flex-1 flex-wrap items-center gap-2">
          {statuses
            .filter((x) => x !== null)
            .map((status) => {
              const isStatusSelected = status === postStatus;

              return (
                <Button
                  key={status}
                  size="sm"
                  variant={isStatusSelected ? "default" : "outline"}
                  className={cn("h-fit px-1.5 py-0.5 text-xs shadow-none", {
                    "bg-under-consideration!":
                      postStatus === "under consideration" &&
                      status === "under consideration",
                    "bg-planned!":
                      postStatus === "planned" && status === "planned",
                    "bg-in-progress!":
                      postStatus === "in progress" && status === "in progress",
                    "bg-done!": postStatus === "done" && status === "done",
                    "bg-declined!":
                      postStatus === "declined" && status === "declined",
                    "text-primary-foreground!": postStatus === status,
                    "border border-transparent": isStatusSelected,
                  })}
                  onClick={(e) => {
                    e.preventDefault();
                    changeStatus(item.status !== status ? status : null);
                  }}
                >
                  {capitalizeFirstLetter(status.replace("-", " "))}
                </Button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
