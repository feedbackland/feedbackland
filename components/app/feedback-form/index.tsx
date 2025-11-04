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
import { useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePlatformUrl } from "@/hooks/use-platform-url";

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
      onError: (error) => {
        if (error?.message?.includes("inappropriate-content")) {
          setErrormessage(
            "Your post could not be published because it appears to violate our community guidelines.",
          );
        } else {
          setErrormessage("Something went wrong. Please try again.");
        }
      },
      onSettled: () => {
        setIsPending(false);
      },
    }),
  );

  const onSubmit = async () => {
    setShowSignUpInDialog(false);
    setIsPending(true);
    const description = await processImagesInHTML(value);
    saveFeedback.mutate({
      description,
    });
  };

  const handleOnSubmitClick = async () => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback");
      return;
    }

    if (!session) {
      setShowSignUpInDialog(true);
      return;
    }

    if (session) {
      onSubmit();
    }
  };

  const hasText = value?.length > 0;

  return (
    <div className={cn("")}>
      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        includeAnonymous={true}
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={onSubmit}
      />

      <div className={cn("flex flex-col gap-3")}>
        <div className={cn("relative w-full")}>
          <Tiptap
            placeholder={`Describe your idea, suggestion or issue. The more context, the better.`}
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
                  onClick={handleOnSubmitClick}
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
    </div>
  );
}
