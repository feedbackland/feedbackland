"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
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
      <Button size="sm" className="" onClick={handleDelete}>
        Delete post
      </Button>
    );
  }

  return null;
}
