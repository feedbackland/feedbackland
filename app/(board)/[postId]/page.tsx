"use client";

import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { GoBackButton } from "@/components/app/feedback-post/go-back-button";
import { CommentForm } from "@/components/app/comment-form";
import { Comments } from "@/components/app/comments";
import FeedbackPostSidebar from "@/components/app/feedback-post-sidebar";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useIsDrawerEmbed } from "@/providers/embed";
import { cn } from "@/lib/utils";

export default function FeedbackPostPage() {
  const isDesktop = useIsDesktop();
  // The post carries no chrome of its own on any surface — no border, rounding
  // or shadow, and from `md` up no background or inset either, so the post reads
  // as text set directly on the page and the sidebar is the only card in view.
  // Below `md` it keeps its own surface and padding, where the post fills the
  // width and needs the inset to stay legible.
  //
  // Inside the slide-in drawer widget it goes further at every width: the "Share
  // your feedback" header is suppressed (see PlatformRoot) so the post's own
  // title heads the panel, and the post sits flush with the drawer's gutter
  // (also from PlatformRoot). The vertical rhythm between the post, the comment
  // form and the comments is the same everywhere.
  const isDrawerEmbed = useIsDrawerEmbed();
  const { postId } = useParams<{ postId: string }>();

  return (
    <>
      {!isDrawerEmbed && (
        // Leaving the post is page-level navigation, so it heads the page rather
        // than the post: on the page's own left edge, above both columns, which
        // leaves the title still the first thing inside the post. It renders
        // before the post query settles, so the way out is there for the whole
        // load rather than arriving with the content.
        //
        // Held back below `md` in CSS rather than behind `useIsDesktop`, whose
        // first value is a guess that assumes desktop off the standalone board —
        // gated on the hook, this would blink into view and out again on a phone.
        <div className="hidden pb-4 md:block">
          <GoBackButton label="Back" />
        </div>
      )}
      <div className="flex flex-row items-start gap-11">
        {isDesktop && <FeedbackPostSidebar postId={postId} />}
        <div className="bg-background w-full min-w-0 flex-1 md:bg-transparent">
          <div
            className={cn("pb-5", {
              "px-5 pt-5 md:px-0 md:pt-0": !isDrawerEmbed,
            })}
          >
            <FeedbackPostFull postId={postId} />
          </div>
          <div className={cn("pt-5", { "px-5 md:px-0": !isDrawerEmbed })}>
            <CommentForm
              postId={postId}
              parentCommentId={null}
              showCloseButton={false}
            />
          </div>
          <div className={cn("py-5", { "px-5 md:px-0": !isDrawerEmbed })}>
            <Comments postId={postId} />
          </div>
        </div>
      </div>
    </>
  );
}
