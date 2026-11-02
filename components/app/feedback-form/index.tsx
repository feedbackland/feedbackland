"use client";
import { useAuth } from "@/hooks/use-auth";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FEEDBACK_TEXT_LENGTH } from "@/lib/feedback-text";
export function FeedbackForm() {
  const { session, isLoaded } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
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
    <>
      <SignUpInDialog
        open={signInOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setSignInOpen(false)}
      />
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
          {session
            ? `Posting as ${session.user.name}.`
            : "Post anonymously, or sign in to manage your feedback."}
        </p>
        <Button
          type="submit"
          disabled={!isLoaded || !description.trim() || mutation.isPending}
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
          <p role="alert">Could not submit feedback. Please try again.</p>
        )}
      </form>
    </>
  );
}
