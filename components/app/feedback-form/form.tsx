"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { User } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useFeedbackPosts } from "@/hooks/useFeedbackPosts";

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
  const { queryKey: getFeedbackPostsQueryKey } = useFeedbackPosts();

  const [value, setValue] = useState("");
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getFeedbackPostsQueryKey });
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
        <div className="relative">
          <Tiptap
            placeholder={`Share your feature request, bug report, or any other feedback...`}
            value={value}
            onChange={onChange}
            className={cn("min-h-32 shadow-sm")}
            showToolbar={true}
            autofocus={true}
          />
          <div className="absolute bottom-2 right-2 flex flex-row-reverse justify-end gap-3">
            <Button
              type="submit"
              size="sm"
              loading={saveFeedback.isPending}
              onClick={() => onSubmit(session)}
              className="order-1"
            >
              <SendIcon className="size-3" />
              Submit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              className="order-2"
            >
              Cancel
            </Button>
          </div>
        </div>
        {errorMessage.length > 0 && <Error title={errorMessage} />}
      </div>
    </>
  );
}
