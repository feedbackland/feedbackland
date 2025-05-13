"use client";

import { useState } from "react";
import { CheckIcon, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FeedbackStatus } from "@/lib/typings";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { useUpdateStatus } from "@/hooks/use-update-status";
import { cn } from "@/lib/utils";
import { isUuidV4 } from "@/lib/utils";

export function FeedbackPostOptionsMenu({
  postId,
  authorId,
  onEdit,
  className,
}: {
  postId: string;
  authorId?: string;
  onEdit?: () => void;
  className?: React.ComponentProps<"div">["className"];
}) {
  const pathname = usePathname();

  const lastUrlSegment = pathname?.split("/")?.pop() || "";
  const isFeedbackPage = isUuidV4(lastUrlSegment);

  const updateStatus = useUpdateStatus({ postId });

  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    query: { data },
  } = useFeedbackPost({
    postId,
    enabled: true,
  });

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const deletePost = useMutation(
    trpc.deleteFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeedMetaData.queryKey(),
        });

        toast.success("Feedback deleted", {
          position: "top-right",
        });

        if (platformUrl && isFeedbackPage) {
          router.push(platformUrl);
        }
      },
      onSettled: () => {
        setIsDeleteConfirmationOpen(false);
      },
    }),
  );

  const handleDelete = async () => {
    deletePost.mutate({
      postId,
    });
  };

  const handleStatusChange: (status: FeedbackStatus) => void = async (
    status,
  ) => {
    updateStatus.mutate({
      postId,
      status,
    });
  };

  const isAuthor = session?.user?.id === authorId;
  const isAdmin = session?.userOrg?.role === "admin";
  const isVisible = !!(isAuthor || isAdmin);
  const status = data?.status;

  if (isVisible) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open options menu"
              className={cn("", className)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="">
            <DropdownMenuGroup>
              {onEdit !== undefined && (
                <DropdownMenuItem onClick={() => onEdit?.()} className="">
                  Edit post
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem
                      className="flex items-center justify-between"
                      onClick={() => handleStatusChange(null)}
                    >
                      <span>No status</span>
                      {status === null && <CheckIcon />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("under consideration")}
                      className="text-under-consideration hover:text-under-consideration! flex items-center justify-between"
                    >
                      <span>Under consideration</span>
                      {status === "under consideration" && (
                        <CheckIcon className="text-under-consideration" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("planned")}
                      className="text-planned hover:text-planned! flex items-center justify-between"
                    >
                      <span>Planned</span>
                      {status === "planned" && (
                        <CheckIcon className="text-planned" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("in progress")}
                      className="text-in-progress hover:text-in-progress! flex items-center justify-between"
                    >
                      <span>In Progress</span>
                      {status === "in progress" && (
                        <CheckIcon className="text-in-progress" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("done")}
                      className="text-done hover:text-done! flex items-center justify-between"
                    >
                      <span>Done</span>
                      {status === "done" && <CheckIcon className="text-done" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("declined")}
                      className="text-declined hover:text-declined! flex items-center justify-between"
                    >
                      <span>Declined</span>
                      {status === "declined" && (
                        <CheckIcon className="text-declined" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setIsDeleteConfirmationOpen(true)}
                className="text-red-500 hover:bg-red-500/10! hover:text-red-500!"
              >
                Delete post
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={isDeleteConfirmationOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure you want to delete this feedback post?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this
                feedback post.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setIsDeleteConfirmationOpen(false)}
                disabled={deletePost.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deletePost.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return null;
}
