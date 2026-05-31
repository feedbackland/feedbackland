import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * BoardSkeleton — the drawer's loading placeholder. It mirrors the Feedbackland
 * board's *narrow* (<768px) layout, which is what actually renders inside the
 * panel's iframe: a header (title + action buttons + description), the feedback
 * form, a sort/search toolbar, and the posts list. Holding this stable shape
 * until the board signals "ready" (then revealing it) makes the hand-off across
 * the cross-origin boundary nearly shift-free.
 *
 * It lives in the host page (not the iframe), so it uses the widget's prefixed
 * `fl:` utilities and inherits the panel's `.fl-scope` theme tokens — so it is
 * automatically light/dark-correct alongside the rest of the widget.
 */

// Per-row title + body line widths, varied for a natural (non-uniform) look.
const POST_ROWS: ReadonlyArray<{ title: string; body: readonly string[] }> = [
  { title: "fl:w-3/5", body: ["fl:w-full", "fl:w-full", "fl:w-11/12"] },
  { title: "fl:w-2/5", body: ["fl:w-full", "fl:w-3/4"] },
  { title: "fl:w-1/2", body: ["fl:w-full", "fl:w-full", "fl:w-4/5"] },
  { title: "fl:w-[55%]", body: ["fl:w-full", "fl:w-2/3"] },
  { title: "fl:w-5/12", body: ["fl:w-full", "fl:w-3/4"] },
];

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn("fl:bg-muted fl:animate-pulse fl:rounded", className)}
    />
  );
}

export const BoardSkeleton = memo(function BoardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="fl:absolute fl:inset-0 fl:z-10 fl:bg-background fl:overflow-hidden"
    >
      <div className="fl:mx-auto fl:flex fl:w-full fl:max-w-5xl fl:flex-col fl:px-4 fl:py-4 fl:sm:px-8">
        {/* Header: title + action buttons, then a description line */}
        <div className="fl:flex fl:flex-col fl:gap-1 fl:pb-5">
          <div className="fl:flex fl:items-center fl:justify-between">
            <Bar className="fl:h-6 fl:w-44" />
            <div className="fl:flex fl:items-center fl:gap-1">
              <Bar className="fl:size-8 fl:rounded-md" />
              <Bar className="fl:size-8 fl:rounded-md" />
            </div>
          </div>
          <Bar className="fl:mt-2 fl:h-4 fl:w-3/5" />
        </div>

        {/* Feedback form: editor content area, then the editor's bottom toolbar
            row (an image-insert button on the left, the submit button on the
            right — matching the real Tiptap form). */}
        <div className="fl:border-border fl:overflow-hidden fl:rounded-lg fl:border">
          <div className="fl:min-h-[60px] fl:p-3">
            <Bar className="fl:h-4 fl:w-44" />
          </div>
          <div className="fl:flex fl:h-12 fl:items-center fl:justify-between fl:px-2">
            <Bar className="fl:size-7 fl:rounded-md" />
            <Bar className="fl:mr-0.5 fl:h-8 fl:w-32 fl:rounded-md" />
          </div>
        </div>

        {/* Narrow/mobile toolbar: a borderless sort link ("Newest ▾") on the
            left and a search icon on the right. */}
        <div className="fl:mt-7 fl:mb-1.5 fl:flex fl:h-[40px] fl:items-center fl:justify-between fl:gap-4">
          <Bar className="fl:h-4 fl:w-20" />
          <Bar className="fl:size-5 fl:rounded-md" />
        </div>

        {/* Posts list */}
        <div className="fl:border-border fl:overflow-hidden fl:rounded-lg fl:border">
          {POST_ROWS.map((row, i) => (
            <div
              key={i}
              className={cn(
                "fl:border-border fl:border-b fl:py-5 fl:pr-3.5 fl:pl-4",
                i === POST_ROWS.length - 1 && "fl:border-b-0",
              )}
            >
              <div className="fl:flex fl:flex-col fl:gap-3.5">
                <div className="fl:flex fl:flex-col fl:gap-1.5">
                  {/* meta line (time • category • status) */}
                  <Bar className="fl:h-3 fl:w-40" />
                  {/* title */}
                  <Bar className={cn("fl:h-5", row.title)} />
                </div>

                {/* body (clamped post description) */}
                <div className="fl:flex fl:flex-col fl:gap-2">
                  {row.body.map((w, j) => (
                    <Bar key={j} className={cn("fl:h-4", w)} />
                  ))}
                </div>

                {/* actions: upvote + comments */}
                <div className="fl:flex fl:items-center fl:gap-2.5">
                  <Bar className="fl:h-[25px] fl:w-14 fl:rounded-md" />
                  <Bar className="fl:h-[25px] fl:w-14 fl:rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
