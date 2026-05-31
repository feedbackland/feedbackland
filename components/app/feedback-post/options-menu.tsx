"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FeedbackStatus } from "@/lib/typings";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { useUpdateStatus } from "@/hooks/use-update-status";
import { cn } from "@/lib/utils";
import { isUuidV4 } from "@/lib/utils";
import { useDeleteFeedbackPost } from "@/hooks/use-delete-feedback-post";

export function FeedbackPostOptionsMenu({
  postId,
  authorId,
  variant = "link",
  onEdit,
  className,
}: {
  postId: string;
  authorId?: string | null;
  variant?: "ghost" | "link" | "default" | "secondary";
  onEdit?: () => void;
  className?: React.ComponentProps<"div">["className"];
}) {
  const pathname = usePathname();

  const lastUrlSegment = pathname?.split("/")?.pop() || "";
  const isFeedbackPage = isUuidV4(lastUrlSegment);

  const updateStatus = useUpdateStatus({ postId });

  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const { session, isAdmin } = useAuth();

  const {
    query: { data },
  } = useFeedbackPost({
    postId,
    enabled: true,
  });

  const deletePost = useDeleteFeedbackPost();

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const handleDelete = async () => {
    deletePost.mutate(
      {
        postId,
      },
      {
        onSuccess: () => {
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
      },
    );
  };

  const isAuthor = session?.user?.id === authorId;
  const isVisible = !!(isAuthor || isAdmin);
  const status = data?.status;

  if (isVisible) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size="icon"
              aria-label="Open options menu"
              className={cn(
                "text-muted-foreground hover:text-primary h-fit w-fit px-1.5 py-1.5 hover:no-underline",
                className,
              )}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {onEdit !== undefined && (
                <DropdownMenuItem onClick={() => onEdit?.()}>
                  Edit post
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuRadioGroup
                      value={status ?? "none"}
                      onValueChange={(value) =>
                        updateStatus.mutate({
                          postId,
                          status:
                            value === "none"
                              ? null
                              : (value as FeedbackStatus),
                        })
                      }
                    >
                      <DropdownMenuRadioItem value="none">
                        No status
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="under consideration"
                        className="text-under-consideration!"
                      >
                        Under consideration
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="planned"
                        className="text-planned!"
                      >
                        Planned
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="in progress"
                        className="text-in-progress!"
                      >
                        In progress
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="done" className="text-done!">
                        Done
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="declined"
                        className="text-declined!"
                      >
                        Declined
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setIsDeleteConfirmationOpen(true)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
                className={buttonVariants({ variant: "destructive" })}
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
