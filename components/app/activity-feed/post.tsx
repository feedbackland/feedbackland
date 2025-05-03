"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { ArrowBigUpIcon, MessageSquare } from "lucide-react";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedbackStatus } from "@/db/schema";
import { useState } from "react";
import { set } from "zod";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [postStatus, setPostStatus] = useState<FeedbackStatus | null>(
    item?.status,
  );

  const updateStatus = useMutation(
    trpc.updateFeedbackPostStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId: item.postId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        // toast.success("Status updated", {
        //   position: "top-right",
        // });
      },
      onSettled: (item) => {
        setPostStatus(item?.status || null);
      },
    }),
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

            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-normal">
              <span className="">
                {capitalizeFirstLetter(
                  item.category || "uncategorized feedback",
                )}
              </span>
              <span className="text-[8px]">•</span>
              <span className="">
                {timeAgo.format(item.createdAt, "twitter")}
              </span>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-1">
                <ArrowBigUpIcon className="size-3.5!" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
                  {item.upvotes || 0}
                </span>
              </div>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="mr-0.5 ml-0.5 size-2.5!" />
                <span className="text-muted-foreground text-xs">0</span>
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
          {statuses.map((status) => {
            // const safeStatus = status.replace("-", " ");
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

                  if (item.status !== status) {
                    setPostStatus(status);

                    updateStatus.mutate({
                      postId: item.postId,
                      status,
                    });
                  } else {
                    setPostStatus(null);

                    updateStatus.mutate({
                      postId: item.postId,
                      status: null,
                    });
                  }
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
