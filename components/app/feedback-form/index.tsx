"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useQueryClient } from "@tanstack/react-query";
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
    <div>
      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        includeAnonymous={true}
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={onSubmit}
      />

      <div className="bg-background rounded-lg border border-border shadow-xs overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:shadow-sm transition-shadow duration-200">
        <div className="relative">
          <Tiptap
            placeholder="Share an idea, report an issue, or give feedback..."
            value={value}
            onChange={onChange}
            autofocus={false}
            editorContentClassName="min-h-[60px]"
            className="border-transparent! shadow-none! hover:shadow-none! ring-0!"
          />
          <div className="absolute right-2.5 bottom-2.5">
            <Button
              type="submit"
              size="sm"
              variant={hasText ? "default" : "secondary"}
              loading={isPending}
              onClick={handleOnSubmitClick}
              disabled={!!(!hasText || isPending)}
              className="transition-all duration-200"
            >
              Submit feedback
              <SendIcon className="size-3.5!" />
            </Button>
          </div>
        </div>

        {errorMessage.length > 0 && (
          <div className="px-4 pb-3">
            <Error title={errorMessage} />
          </div>
        )}
      </div>
    </div>
  );
}
