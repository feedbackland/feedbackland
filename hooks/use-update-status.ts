import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { useAuth } from "./use-auth";

export function useUpdateStatus({ postId }: { postId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";

  const saveComment = useMutation(
    trpc.createComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getComments.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId }),
        });
      },
    }),
  );

  const mutation = useMutation(
    trpc.updateFeedbackPostStatus.mutationOptions({
      onSuccess: (post) => {
        if (isAdmin && post.status) {
          saveComment.mutate({
            postId,
            parentCommentId: null,
            content: `Status updated to <span data-type="status" data-id="${post.id}" data-label="${post.status.replace(" ", "-")}">${post.status}</span>`,
          });
        }

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId: postId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });
      },
    }),
  );

  return mutation;
}
