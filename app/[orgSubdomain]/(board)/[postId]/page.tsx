"use client";

import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { CommentForm } from "@/components/app/comment-form";
import { Comments } from "@/components/app/comments";
import FeedbackPostSidebar from "@/components/app/feedback-post-sidebar";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useIsDrawerEmbed } from "@/providers/embed";
import { cn } from "@/lib/utils";

export default function FeedbackPostPage() {
  const isDesktop = useIsDesktop();
  // Inside the slide-in drawer widget the post stands alone in a dedicated
  // panel whose "Share your feedback" header is suppressed (see PlatformRoot),
  // so the post's own title heads the panel. The card chrome (border, rounding,
  // shadow) and the inset between content and that border are dropped — the
  // post reads borderless and flush with the drawer's gutter (also from
  // PlatformRoot), and the first section sheds its top padding so the title
  // sits at the panel top. Vertical rhythm between sections is preserved.
  const isDrawerEmbed = useIsDrawerEmbed();
  const { postId } = useParams<{ postId: string }>();

  return (
    <div className="flex flex-row items-start gap-11">
      {isDesktop && <FeedbackPostSidebar postId={postId} />}
      <div
        className={cn("bg-background w-full min-w-0 flex-1", {
          "rounded-lg border border-border shadow-xs": !isDrawerEmbed,
        })}
      >
        <div className={cn("pb-5", { "px-5 pt-5": !isDrawerEmbed })}>
          <FeedbackPostFull postId={postId} />
        </div>
        <div className={cn("pt-5", { "px-5": !isDrawerEmbed })}>
          <CommentForm
            postId={postId}
            parentCommentId={null}
            showCloseButton={false}
          />
        </div>
        <div className={cn("py-5", { "px-5": !isDrawerEmbed })}>
          <Comments postId={postId} />
        </div>
      </div>
    </div>
  );
}
