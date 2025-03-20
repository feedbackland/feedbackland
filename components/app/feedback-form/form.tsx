"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { User } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { dequal } from "dequal";

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

  const onSubmit = async (user: User | null) => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback");
      return;
    }

    if (!user) {
      setShowSignUpInDialog(true);
      return;
    }

    const description = await processImagesInHTML(value);

    saveFeedback.mutate({
      description,
    });
  };

  const handleEscapeKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setValue("");
        onClose?.();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscapeKeyPress);

    return () => {
      document.removeEventListener("keydown", handleEscapeKeyPress);
    };
  }, [handleEscapeKeyPress]);

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
      <div className="flex min-h-[123px] flex-col gap-3">
        <div className="relative">
          <Tiptap
            placeholder={`Any feedback? We’d love to hear from you!`}
            value={value}
            onChange={onChange}
            className={cn(
              "min-h-[7.7rem] shadow-xs",
              isFocused && "ring-ring ring-1",
            )}
            showToolbar={true}
            autofocus={true}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
          />
          <div className="absolute right-2.5 bottom-2.5 flex flex-row-reverse justify-end gap-3">
            <Button
              type="submit"
              size="icon"
              loading={saveFeedback.isPending}
              onClick={() => onSubmit(session)}
              className="size-auto p-2"
              disabled={!hasText || saveFeedback.isPending}
            >
              <SendIcon className="size-3" />
            </Button>
          </div>
        </div>
        {errorMessage.length > 0 && <Error title={errorMessage} />}
      </div>
    </>
  );
}
