"use client";
import { useAuth } from "@/hooks/use-auth";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import {
  MAX_FEEDBACK_TEXT_LENGTH,
  MAX_FEEDBACK_HTML_BYTES,
} from "@/lib/feedback-text";
import { imageId } from "@/lib/images/path";
import { hasPendingUpload } from "@/components/ui/minimal-tiptap/upload";
function draftError(html: string) {
  if (!html) return "empty";
  if (new TextEncoder().encode(html).length > MAX_FEEDBACK_HTML_BYTES)
    return "Feedback formatting exceeds the size limit.";
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const br of template.content.querySelectorAll("br"))
    br.replaceWith("\n");
  const text = template.content.textContent ?? "";
  if (text.length > MAX_FEEDBACK_TEXT_LENGTH)
    return "Feedback must be 10,000 characters or fewer.";
  if (
    !text.trim() &&
    !Array.from(template.content.querySelectorAll("img")).some((img) =>
      imageId(img.getAttribute("src") ?? ""),
    )
  )
    return "empty";
  return "";
}
export function FeedbackForm() {
  const { session, isLoaded } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [description, setDescription] = useState("");
  const validation = useMemo(() => draftError(description), [description]);
  const canSubmit = !validation && !hasPendingUpload(description);
  const trpc = useTRPC(),
    cache = useQueryClient();
  const mutation = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess() {
        setDescription("");
        void cache.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });
      },
    }),
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit && isLoaded && !mutation.isPending)
      mutation.mutate({ description, descriptionFormat: "html" });
  };
  return (
    <>
      <SignUpInDialog
        open={signInOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setSignInOpen(false)}
      />
      <form onSubmit={submit} className="space-y-3">
        <Tiptap
          ariaLabel="Your feedback"
          placeholder="Share your feedback…"
          value={description}
          onChange={setDescription}
        />
        <p className="text-muted-foreground text-xs">
          {session
            ? `Posting as ${session.user.name}.`
            : "Post anonymously, or sign in to manage your feedback."}
        </p>
        {validation && validation !== "empty" && (
          <p role="alert">{validation}</p>
        )}
        <Button
          type="submit"
          disabled={!isLoaded || !canSubmit || mutation.isPending}
        >
          Submit feedback
        </Button>
        {isLoaded && !session && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setSignInOpen(true)}
          >
            Sign in to manage feedback
          </Button>
        )}
        {mutation.isSuccess && <p role="status">Feedback submitted</p>}
        {mutation.isError && (
          <p role="alert">
            {mutation.error.data?.code === "BAD_REQUEST"
              ? mutation.error.message
              : "Could not submit feedback. Please try again."}
          </p>
        )}
      </form>
    </>
  );
}
