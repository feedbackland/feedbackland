"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { Session } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useActivityFeedbackPostsCount } from "@/hooks/use-active-feedback-posts-count";
import { useSubscription } from "@/hooks/use-subscription";

export function FeedbackForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const { session } = useAuth();
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const {
    query: { data: activityFeedbackPostsCount },
  } = useActivityFeedbackPostsCount();

  const {
    query: { data: subscription },
  } = useSubscription();

  console.log("subscription", subscription);
  console.log("activityFeedbackPostsCount", activityFeedbackPostsCount);

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: ({ id }) => {
        setValue("");

        toast.success("Feedback submitted", {
          position: "top-right",
          action: {
            label: "View your feedback",
            onClick: () => router.push(`${platformUrl}/${id}`),
          },
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeedMetaData.queryKey(),
        });
      },
      onError: () => {
        setErrormessage("Something went wrong. Please try again.");
      },
      onSettled: () => {
        setIsPending(false);
      },
    }),
  );

  const onSubmit = async (session: Session) => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback");
      return;
    }

    if (!session) {
      setShowSignUpInDialog(true);
      return;
    }

    setIsPending(true);

    const description = await processImagesInHTML(value);

    saveFeedback.mutate({
      description,
    });
  };

  const hasText = value?.length > 0;

  return (
    <>
      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={(newSession) => {
          setShowSignUpInDialog(false);
          onSubmit(newSession);
        }}
      />
      <div className={cn("flex flex-col gap-3")}>
        <div className="dark:bg-input/30 border-input relative min-h-[93px] w-full rounded-lg">
          <Tiptap
            placeholder={`Share your feature request, bug report, or any other feedback...`}
            value={value}
            onChange={onChange}
            autofocus={false}
          />
          <div className="absolute right-2.5 bottom-2.5 flex flex-row-reverse justify-end gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  loading={isPending}
                  onClick={() => onSubmit(session)}
                  disabled={!!(!hasText || isPending)}
                  className="size-8!"
                >
                  <SendIcon className="size-4!" />
                  <span className="sr-only">Submit feedback</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Submit feedback</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {errorMessage.length > 0 && <Error title={errorMessage} />}
      </div>
    </>
  );
}
