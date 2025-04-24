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
import { Session } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { dequal } from "dequal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FeedbackForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
      onSuccess: () => {
        setValue("");

        queryClient.invalidateQueries({
          predicate: (query) => {
            return dequal(
              query.queryKey?.[0],
              trpc.getFeedbackPosts.queryKey()[0],
            );
          },
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
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Tiptap
            placeholder={`Share your idea, suggestion, issue, or any other feedback...`}
            value={value}
            onChange={onChange}
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
                  disabled={!hasText || isPending}
                  className="size-8!"
                >
                  <SendIcon className="size-4!" />
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
