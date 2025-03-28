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
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { dequal } from "dequal";
import { useKey } from "react-use";

export function FeedbackForm({
  onClose,
  onSuccess,
}: {
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [isEditorLoaded, setIsEditorLoaded] = useState(false);
  const [value, setValue] = useState("");
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { queryKey: feedbackPostsQueryKey } = useFeedbackPosts({});

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return dequal(query.queryKey?.[0], feedbackPostsQueryKey?.[0]);
          },
        });
        setValue("");
        onSuccess?.();
      },
      onError: () => {
        setErrormessage("Something went wrong. Please try again.");
      },
    }),
  );

  const onSubmit = async (session: Session | null) => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback");
      return;
    }

    if (!session) {
      setShowSignUpInDialog(true);
      return;
    }

    const description = await processImagesInHTML(value);

    saveFeedback.mutate({
      description,
    });
  };

  useKey("Escape", () => {
    setValue("");
    onClose?.();
  });

  const hasText = value?.length > 0;

  return (
    <>
      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={(user) => {
          setShowSignUpInDialog(false);
          onSubmit(user);
        }}
      />
      <div className="flex flex-col gap-3">
        <div className="relative min-h-[7.7rem] w-full">
          <Tiptap
            placeholder={`Add your feature request, bug report, or any other feedback…`}
            // placeholder="Any feedback? We’d love to hear from you!"
            value={value}
            onChange={onChange}
            className={cn("min-h-[7.7rem]", isFocused && "ring-ring ring-1")}
            showToolbar={true}
            autofocus={true}
            onCreate={() => {
              setIsEditorLoaded(true);
            }}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
          />
          {isEditorLoaded && (
            <div className="absolute right-2.5 bottom-2.5 flex flex-row-reverse justify-end gap-2.5">
              {/* <Button
                type="submit"
                size="default"
                loading={saveFeedback.isPending}
                onClick={() => onSubmit(session)}
                disabled={!hasText || saveFeedback.isPending}
              >
                <SendIcon className="size-3" />
                Submit feedback
              </Button> */}
              {/* <Button
                variant="secondary"
                size="default"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button> */}
              {/* <Button variant="ghost" size="icon" onClick={() => onClose?.()}>
                <XIcon className="size-3" />
              </Button> */}
              <Button
                type="submit"
                size="icon"
                loading={saveFeedback.isPending}
                onClick={() => onSubmit(session)}
                disabled={!hasText || saveFeedback.isPending}
                className="size-8!"
              >
                <SendIcon className="size-4!" />
              </Button>
            </div>
          )}
        </div>
        {errorMessage.length > 0 && <Error title={errorMessage} />}
      </div>
    </>
  );
}
