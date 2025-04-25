"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { cn, processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { Session } from "@/hooks/use-auth";
import { useKey } from "react-use";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function CommentForm({
  postId,
  parentCommentId,
  replyToAuthorId,
  replyToAuthorName,
  scrollIntoView = false,
  onClose,
  onSuccess,
  className,
}: {
  postId: string;
  parentCommentId: string | null;
  replyToAuthorId?: string;
  replyToAuthorName?: string | null;
  scrollIntoView?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { session } = useAuth();
  const elementRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false); // Ref to track if we've already scrolled once

  useEffect(() => {
    const element = elementRef.current;

    if (!scrollIntoView || !element || hasScrolledRef.current) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !hasScrolledRef.current) {
        element.scrollIntoView();
        hasScrolledRef.current = true;
      }
      observer.disconnect();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [scrollIntoView]);

  const initialContent = !!(replyToAuthorId && replyToAuthorName)
    ? `<span class="mention" data-type="mention" data-id="${replyToAuthorId}" data-label="${replyToAuthorName}">@${replyToAuthorName}</span>&nbsp;`
    : "";

  const [value, setValue] = useState(initialContent);
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

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

        setValue("");
        onSuccess?.();
      },
      onError: () => {
        setErrormessage("Something went wrong. Please try again.");
      },
    }),
  );

  const onSubmit = async (session: Session) => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter a comment");
      return;
    }

    if (!session) {
      setShowSignUpInDialog(true);
      return;
    }

    const content = await processImagesInHTML(value);

    await saveComment.mutateAsync({
      postId,
      parentCommentId,
      content,
    });

    onClose?.();
  };

  useKey("Escape", () => {
    // Reset to initial state on Escape, not just empty
    setValue(initialContent);
    onClose?.();
  });

  // Check if text exists beyond the initial mention (if any)
  const hasText = value?.replace(initialContent, "").trim().length > 0;

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
      <div ref={elementRef} className={cn("flex flex-col gap-3", className)}>
        <div className="relative flex items-start gap-2">
          <Tiptap
            placeholder={`Add a comment...`}
            value={value}
            onChange={onChange}
          />
          <div className="absolute right-3 bottom-3 flex flex-row-reverse justify-end gap-2.5">
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

            {/* <Button
              type="submit"
              size="icon"
              loading={saveComment.isPending}
              onClick={() => onSubmit(session)}
              disabled={!hasText || saveComment.isPending}
              className="size-8!"
            >
              <SendIcon className="size-4!" />
            </Button> */}

            <Button
              type="submit"
              size="icon"
              variant="ghost"
              loading={saveComment.isPending}
              onClick={() => onSubmit(session)}
              disabled={!hasText || saveComment.isPending}
              className="size-8!"
            >
              <SendIcon className="size-4!" />
            </Button>
          </div>
        </div>
        {errorMessage.length > 0 && <Error title={errorMessage} />}
      </div>
    </>
  );
}
