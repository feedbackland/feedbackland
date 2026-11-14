"use client";
import { useSettings } from "@/hooks/use-settings";
import { contentMessage } from "@/lib/content-message";
import { applyDraftText, draftText } from "./draft";
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
  const { capabilities } = useSettings();
  const [signInOpen, setSignInOpen] = useState(false);
  const [description, setDescription] = useState("");
  const validation = useMemo(() => draftError(description), [description]);
  const canSubmit = !validation && !hasPendingUpload(description);
  const rewriteText = useMemo(
    () => (capabilities.chat && canSubmit ? draftText(description) : ""),
    [capabilities.chat, canSubmit, description],
  );
  const canRewrite =
    !!rewriteText && rewriteText.length <= MAX_FEEDBACK_TEXT_LENGTH;
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
  const rewrite = useMutation(trpc.rewriteFeedback.mutationOptions());
  const improve = async () => {
    const original = description;
    if (!canRewrite || rewrite.isPending || mutation.isPending) return;
    try {
      const result = await rewrite.mutateAsync({ description: rewriteText });
      setDescription((current) =>
        current === original
          ? applyDraftText(original, result.description)
          : current,
      );
    } catch {
      /* The mutation exposes its typed error below. */
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit && isLoaded && !mutation.isPending && !rewrite.isPending)
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
          disabled={
            !isLoaded || !canSubmit || mutation.isPending || rewrite.isPending
          }
        >
          Submit feedback
        </Button>
        {capabilities.chat && (
          <Button
            type="button"
            variant="outline"
            disabled={!canRewrite || rewrite.isPending || mutation.isPending}
            onClick={improve}
          >
            {rewrite.isPending ? "Improving draft…" : "Improve my draft"}
          </Button>
        )}
        {rewrite.isError && (
          <p role="alert">
            {contentMessage(
              rewrite.error,
              "Could not improve this draft. Please try again.",
            )}
          </p>
        )}
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
            {contentMessage(
              mutation.error,
              "Could not submit feedback. Please try again.",
            )}
          </p>
        )}
      </form>
    </>
  );
}
