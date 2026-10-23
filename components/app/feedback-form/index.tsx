"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FEEDBACK_TEXT_LENGTH } from "@/lib/feedback-text";
export function FeedbackForm() {
  const [description, setDescription] = useState("");
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
    mutation.mutate({ description });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="feedback-description" className="sr-only">
        Your feedback
      </label>
      <Textarea
        id="feedback-description"
        placeholder="Share your feedback…"
        maxLength={MAX_FEEDBACK_TEXT_LENGTH}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
      />
      <p className="text-muted-foreground text-xs">
        Anonymous text feedback. Attachments and sign-in arrive in later
        milestones.
      </p>
      <Button
        type="submit"
        disabled={!description.trim() || mutation.isPending}
      >
        Submit feedback
      </Button>
      {mutation.isSuccess && <p role="status">Feedback submitted</p>}
      {mutation.isError && (
        <p role="alert">Could not submit feedback. Please try again.</p>
      )}
    </form>
  );
}
