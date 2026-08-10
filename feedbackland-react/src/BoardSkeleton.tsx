import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * BoardSkeleton — the drawer's loading placeholder. It mirrors the layout the
 * board actually renders inside this panel: the drawer's own single-line
 * "Share your feedback" heading (not the standalone board's title + action
 * buttons + description), the feedback form, the sort/search toolbar, and the
 * posts list.
 *
 * The geometry is deliberate, not decorative — every box below is sized to land
 * on the same pixel as its counterpart in the board, so swapping the shimmer for
 * the live iframe moves nothing:
 *
 *  - `py-4` + a 28px heading line + `pb-5` puts the form card at y=64, matching
 *    the board's `px-4 xs:px-8 py-4` container and `pb-5` heading block.
 *  - The horizontal inset switches at 30rem of *panel* width via a container
 *    query, because the board's matching `xs:` breakpoint is evaluated against
 *    the iframe's viewport — i.e. the panel — not the host page's. A plain
 *    `sm:` media query here would read the host viewport and disagree with the
 *    board on any host narrower than 40rem.
 *  - `overflow-y-scroll` reserves the same scrollbar gutter the board's own
 *    scrolling document takes, so the content column is the same width in both.
 *    Asking for the real scrollbar (rather than hard-coding a width) keeps this
 *    correct on overlay-scrollbar platforms, where both gutters are zero.
 *
 * Post rows can only approximate real posts, whose height depends on their text;
 * the list's top edge is exact, which is what the eye tracks.
 *
 * It lives in the host page (not the iframe), so it uses the widget's prefixed
 * `fl:` utilities and inherits the panel's `.fl-scope` theme tokens — so it is
 * automatically light/dark-correct alongside the rest of the widget.
 */

// Per-row title + body line widths, varied for a natural (non-uniform) look.
const POST_ROWS: ReadonlyArray<{ title: string; body: readonly string[] }> = [
  { title: "fl:w-3/5", body: ["fl:w-full", "fl:w-11/12"] },
  { title: "fl:w-2/5", body: ["fl:w-3/4"] },
  { title: "fl:w-1/2", body: ["fl:w-full", "fl:w-full", "fl:w-4/5"] },
  { title: "fl:w-[55%]", body: ["fl:w-full", "fl:w-2/3"] },
  { title: "fl:w-5/12", body: ["fl:w-3/4"] },
];

function Bar({ className }: { className?: string }) {
  return (
    <div className={cn("fl:bg-muted fl:animate-pulse fl:rounded", className)} />
  );
}

export const BoardSkeleton = memo(function BoardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="fl:absolute fl:inset-0 fl:z-10 fl:bg-background fl:overflow-y-scroll"
    >
      {/* `h-full overflow-hidden` clips the column to the panel, so the scroller
          above it has scrollHeight === clientHeight. That keeps the reserved
          gutter (`overflow-y-scroll` always paints a classic scrollbar track)
          while leaving nothing to scroll: `react-remove-scroll` inside the
          widget's `FocusOn` lock permits wheel/touch only on ancestors whose
          scrollHeight exceeds their clientHeight, so the shimmer stays inert.
          Without this the shimmer became its own scrollable layer over the
          iframe, and because it is a sibling of the frame rather than part of
          the board's document, whatever the user scrolled was thrown away —
          the board appeared back at the top the instant this unmounted. */}
      <div className="fl:h-full fl:overflow-hidden">
        {/* The inset switches at 480px of *panel* width, matching the board's
            `xs:` breakpoint. Both sides are stated in px on purpose: a length in
            a container/media query condition cannot read a custom property, so
            `--fl-root` can't reach it, and `30rem` here would resolve against
            the host page's root font-size while the board's `xs:` resolves
            against the iframe's. See `--breakpoint-xs` in app/globals.css. */}
        <div className="fl:mx-auto fl:flex fl:w-full fl:max-w-5xl fl:flex-col fl:px-4 fl:@min-[480px]:px-8 fl:py-4">
          {/* Heading: the drawer's "Share your feedback" title — one 28px line
            followed by the same `pb-5` the board's heading block carries. */}
          <div className="fl:pb-5">
            <div className="fl:flex fl:h-7 fl:items-center">
              <Bar className="fl:h-5 fl:w-48" />
            </div>
          </div>

          {/* Feedback form: editor content area, then the editor's bottom toolbar
            row (an image-insert button on the left, the submit button on the
            right — matching the real Tiptap form). */}
          <div className="fl:border-border fl:overflow-hidden fl:rounded-lg fl:border">
            <div className="fl:min-h-[62px] fl:p-3">
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
    </div>
  );
});
