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
  // The post renders without card chrome (border, rounding, shadow) on every
  // surface. Inside the slide-in drawer widget it goes further: the "Share your
  // feedback" header is suppressed (see PlatformRoot) so the post's own title
  // heads the panel, the horizontal inset is dropped so the post sits flush with
  // the drawer's gutter (also from PlatformRoot), and the first section sheds
  // its top padding so the title sits at the panel top. On the full platform the
  // sections keep their comfortable padding.
  const isDrawerEmbed = useIsDrawerEmbed();
  const { postId } = useParams<{ postId: string }>();

  return (
    <div className="flex flex-row items-start gap-11">
      {isDesktop && <FeedbackPostSidebar postId={postId} />}
      <div className="bg-background w-full min-w-0 flex-1">
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
