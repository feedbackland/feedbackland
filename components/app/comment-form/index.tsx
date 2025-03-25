"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { User } from "firebase/auth";
import { useComments } from "@/hooks/use-comments";
import { dequal } from "dequal";
import { useKey } from "react-use";

export function CommentForm({
  postId,
  parentCommentId,
  onClose,
  onSuccess,
}: {
  postId: string;
  parentCommentId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { session } = useAuth();
  const [value, setValue] = useState("");
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { queryKey: commentsQueryKey } = useComments({
    postId,
    enabled: false,
  });

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const saveComment = useMutation(
    trpc.createComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return dequal(query.queryKey?.[0], commentsQueryKey?.[0]);
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
      setErrormessage("Please enter a comment");
      return;
    }

    if (!user) {
      setShowSignUpInDialog(true);
      return;
    }

    const content = await processImagesInHTML(value);

    saveComment.mutate({
      postId,
      parentCommentId,
      content,
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
      <div className="flex min-h-[7.7rem] flex-col gap-3">
        <div className="relative">
          <Tiptap
            placeholder={`Add a comment`}
            value={value}
            onChange={onChange}
            className={cn(
              "min-h-[7.7rem] shadow-xs",
              isFocused && "ring-ring ring-1",
            )}
            showToolbar={true}
            autofocus={true}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <div className="absolute right-2.5 bottom-2.5 flex flex-row-reverse justify-end gap-2.5">
            {/* <Button
              type="submit"
              size="sm"
              loading={saveComment.isPending}
              onClick={() => onSubmit(session)}
              disabled={!hasText || saveComment.isPending}
            >
              <SendIcon className="size-3" />
              Submit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onClose?.()}>
              Cancel
            </Button> */}
            <Button
              type="submit"
              size="icon"
              loading={saveComment.isPending}
              onClick={() => onSubmit(session)}
              disabled={!hasText || saveComment.isPending}
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
