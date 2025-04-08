"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { dequal } from "dequal";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";

export function FeedbackPostDeleteButton({
  postId,
  authorId,
}: {
  postId: string;
  authorId: string;
}) {
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { queryKey: feedbackPostsQueryKey } = useFeedbackPosts({
    enabled: false,
  });

  const deletePost = useMutation(
    trpc.deleteFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return dequal(query.queryKey?.[0], feedbackPostsQueryKey?.[0]);
          },
        });

        if (platformUrl) {
          router.push(platformUrl);
        }
      },
    }),
  );

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync({
        postId,
      });
    } catch {
      // do nothing
    }
  };

  if (session?.user?.id === authorId || session?.userOrg?.role === "admin") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" className="">
            Delete post
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              feedback post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return null;
}
