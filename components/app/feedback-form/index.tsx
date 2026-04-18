"use client";

import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { processImagesInHTML } from "@/lib/utils";
import { SendIcon, SparklesIcon } from "lucide-react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Error } from "@/components/ui/error";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function stripHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
  return html.replace(/<[^>]*>?/gm, "");
}

export function FeedbackForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const { session } = useAuth();
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrormessage] = useState("");
  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);
  const originalValueRef = useRef<string | null>(null);

  const onChange = (value: string) => {
    setErrormessage("");
    setValue(value);
  };

  const rewriteFeedbackMutation = useMutation(
    trpc.rewriteFeedback.mutationOptions({
      onSuccess: (data) => {
        const rewrittenDescription = data.description;

        // Wrap plain text in <p> tags for Tiptap if it doesn't contain HTML
        const htmlValue = rewrittenDescription.includes("<")
          ? rewrittenDescription
          : `<p>${rewrittenDescription.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;

        setValue(htmlValue);

        toast.success("Feedback improved", {
          position: "top-right",
          description:
            "AI polished your feedback. You can undo if you prefer the original.",
          action: {
            label: "Undo",
            onClick: () => {
              if (originalValueRef.current !== null) {
                setValue(originalValueRef.current);
                originalValueRef.current = null;
                toast.info("Reverted to original", {
                  position: "top-right",
                });
              }
            },
          },
          duration: 8000,
        });
      },
      onError: () => {
        originalValueRef.current = null;
        setErrormessage("Could not improve feedback. Please try again.");
      },
    }),
  );

  const isRewriting = rewriteFeedbackMutation.isPending;

  const handleRewrite = () => {
    if (!value || value.trim().length === 0 || isRewriting) return;

    const plainText = stripHtml(value);
    if (!plainText.trim()) return;

    // Save original value BEFORE the mutation starts, so undo always
    // restores the exact content that was in the editor at click time
    originalValueRef.current = value;
    setErrormessage("");
    rewriteFeedbackMutation.mutate({ description: plainText });
  };

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: ({ id }) => {
        setValue("");
        originalValueRef.current = null;

        toast.success("Feedback submitted", {
          position: "top-right",
          action: {
            label: "View your feedback",
            onClick: () => router.push(`${platformUrl}/${id}`),
          },
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeedMetaData.queryKey(),
        });
      },
      onError: (error) => {
        if (error?.message?.includes("inappropriate-content")) {
          setErrormessage(
            "Your post could not be published because it appears to violate our community guidelines.",
          );
        } else {
          setErrormessage("Something went wrong. Please try again.");
        }
      },
      onSettled: () => {
        setIsPending(false);
      },
    }),
  );

  const onSubmit = async () => {
    setShowSignUpInDialog(false);
    setIsPending(true);
    const description = await processImagesInHTML(value);
    saveFeedback.mutate({
      description,
    });
  };

  const handleOnSubmitClick = async () => {
    if (!value || value.trim().length === 0) {
      setErrormessage("Please enter some feedback");
      return;
    }

    if (!session) {
      setShowSignUpInDialog(true);
      return;
    }

    if (session) {
      onSubmit();
    }
  };

  const hasText = value?.length > 0;

  return (
    <div>
      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        includeAnonymous={true}
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={onSubmit}
      />

      <div className="bg-background border-border focus-within:ring-ring overflow-hidden rounded-lg border shadow-xs transition-shadow duration-200 focus-within:shadow-sm focus-within:ring-1">
        <div className="relative">
          <Tiptap
            placeholder="Share an idea, report an issue, or give feedback..."
            value={value}
            onChange={onChange}
            autofocus={false}
            editorContentClassName="min-h-[60px]"
            className="border-transparent! shadow-none! ring-0! hover:shadow-none!"
          />
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {hasText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleRewrite}
                    disabled={isRewriting || isPending}
                    className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs transition-all duration-200"
                  >
                    {isRewriting ? (
                      <>
                        <SparklesIcon className="size-3 animate-pulse" />
                        <span>Improving…</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="size-3" />
                        <span>Improve</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <p>Let AI polish your feedback</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              type="submit"
              size="sm"
              variant={hasText ? "default" : "secondary"}
              loading={isPending}
              onClick={handleOnSubmitClick}
              disabled={!!(!hasText || isPending || isRewriting)}
              className="transition-all duration-200"
            >
              Submit feedback
              <SendIcon className="size-3.5!" />
            </Button>
          </div>
        </div>

        {errorMessage.length > 0 && (
          <div className="px-4 pb-3">
            <Error title={errorMessage} />
          </div>
        )}
      </div>
    </div>
  );
}
