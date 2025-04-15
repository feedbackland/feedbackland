"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { dequal } from "dequal";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useComments } from "@/hooks/use-comments";

export function FeedbackPostOptionsMenu({
  postId,
  commentId,
  authorId,
  onEdit,
}: {
  postId: string;
  commentId: string;
  authorId: string;
  onEdit: () => void;
}) {
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { queryKey: commentsQueryKey } = useComments({
    postId,
    enabled: false,
  });

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const deleteComment = useMutation(
    trpc.deleteComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return dequal(query.queryKey?.[0], commentsQueryKey?.[0]);
          },
        });

        if (platformUrl) {
          router.push(platformUrl);
          toast.success("Comment deleted", {
            position: "top-right",
          });
        }
      },
      onSettled: () => {
        setIsDeleteConfirmationOpen(false);
      },
    }),
  );

  const handleDelete = async () => {
    deleteComment.mutate({
      commentId,
    });
  };

  const isAuthor = session?.user?.id === authorId;
  const isAdmin = session?.userOrg?.role === "admin";
  const isVisible = !!(isAuthor || isAdmin);

  if (isVisible) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open options menu">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit()} className="">
              Edit comment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsDeleteConfirmationOpen(true)}
              className="text-red-500 hover:bg-red-500/10! hover:text-red-500!"
            >
              Delete comment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={isDeleteConfirmationOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure you want to delete this comment?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The comment will be permanently
                deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setIsDeleteConfirmationOpen(false)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
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
