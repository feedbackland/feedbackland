"use client";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import { useAuiState } from "@assistant-ui/react";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Citation } from "@/components/app/ask-ai/citations";
import {
  CITATION_SCHEME,
  UUID_PATTERN,
  getCitedPostId,
  normaliseCitations,
} from "@/lib/ask-ai";
import { cn } from "@/lib/utils";

/**
 * Answer text.
 *
 * Sized for a paragraph inside a conversation rather than for a document: an
 * `##` the model throws in becomes a bolder line, not a 30px display heading,
 * and nothing here is wide or airy enough to push the next answer off screen.
 * No `prose` class — every element the model can emit is styled below, and
 * layering Tailwind Typography on top of that only produces two sets of rules
 * disagreeing about margins.
 */
const MarkdownTextImpl = () => {
  // Withholding the unfinished tail is only ever right mid-stream. On finished
  // text the last characters are final, and a literal "[note]" at the end of it
  // would be swallowed for good. Scoped to this part rather than to the message,
  // so an earlier part that has already closed is left alone while a later one
  // is still arriving.
  const isStreaming = useAuiState(
    (state) => state.part.status?.type === "running",
  );

  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      urlTransform={urlTransform}
      preprocess={isStreaming ? tidyStreamingText : closeCitationGaps}
      // assistant-ui's typewriter reveal tracks how much of the text it has
      // shown by index, so it cannot cope with text that changes length behind
      // it — and withholding an unfinished citation does exactly that. Measured
      // with it on, the answer jumped backwards five times per answer, twice
      // restarting from its first word. Off, the render is monotonic. Model
      // tokens arrive a few characters at a time anyway, so the text still
      // flows; it just never un-writes itself.
      smooth={false}
      // An answer about feedback has no business embedding an image, and the
      // model's output is steered by user-submitted post content — so a
      // prompt-injected `![](https://…)` would otherwise fetch a remote URL and
      // report the admin's IP back to whoever wrote the post.
      disallowedElements={["img"]}
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

/**
 * Two things, both about how a citation looks while it is still arriving.
 *
 * A citation is 46 characters of markup that render as a single superscript, and
 * markdown only knows it is a link once the closing bracket lands. Streamed four
 * characters at a time, that means half a second of `[1](post:8f3a1c2e-…` sitting
 * in the middle of the answer before it snaps into a number. Holding the
 * unfinished tail back until it is complete is what makes a citation appear
 * fully formed instead of assembling itself in public.
 *
 * The gap is the other half. Models put a space before a citation about as often
 * as not, which leaves the superscript floating between two sentences rather
 * than attached to the one it supports. Closing it here fixes it every time,
 * where asking in the prompt fixes it most of the time — and only ahead of a
 * well-formed citation, since a malformed one is about to be rendered as
 * ordinary text and should keep the space in front of it.
 */
const CITATION_GAP = new RegExp(
  `[ \\t]+(?=\\[[^\\]]*\\]\\(${CITATION_SCHEME}${UUID_PATTERN}\\))`,
  "gi",
);

/**
 * A citation that has not finished streaming: an open bracket, and then any
 * prefix of `](post:<id>)`. Anchored to the end, so it only ever withholds the
 * few characters currently in flight.
 */
const UNFINISHED_CITATION =
  /[ \t]*\[[^\]\n]{0,8}(?:\](?:\((?:p(?:o(?:s(?:t(?::[0-9a-fA-F-]*)?)?)?)?)?)?)?$/;

/**
 * Normalise first: every recognised citation shape becomes the link form, so the
 * gap rule below has one thing to look for and the renderer one thing to match.
 */
const closeCitationGaps = (text: string) =>
  normaliseCitations(text).replace(CITATION_GAP, "");

const tidyStreamingText = (text: string) =>
  closeCitationGaps(text).replace(UNFINISHED_CITATION, "");

/**
 * react-markdown drops any URL whose scheme it does not recognise, which would
 * silently delete every citation. This lets our own scheme through and applies
 * react-markdown's own rule to everything else, so a `javascript:` link written
 * into a feedback post still cannot reach the page.
 */
const SAFE_PROTOCOL = /^(https?|mailto):/i;

function urlTransform(url: string) {
  if (getCitedPostId(url)) return url;

  const colon = url.indexOf(":");
  const pathStart = url.search(/[/?#]/);

  // No scheme at all — a relative path or a fragment.
  if (colon === -1 || (pathStart !== -1 && colon > pathStart)) return url;

  return SAFE_PROTOCOL.test(url) ? url : "";
}

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root bg-muted text-muted-foreground mt-3 flex items-center justify-between gap-4 rounded-t-lg border-b px-3 py-1.5 text-xs font-medium">
      <span className="aui-code-header-language lowercase">{language}</span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy} className="size-6">
        {!isCopied && <CopyIcon className="size-3.5" />}
        {isCopied && <CheckIcon className="size-3.5" />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const heading = "mt-4 mb-2 font-semibold first:mt-0 last:mb-0";

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn("aui-md-h1 text-[15px]", heading, className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("aui-md-h2 text-[15px]", heading, className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("aui-md-h3", heading, className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("aui-md-h4", heading, className)} {...props} />
  ),
  h5: ({ className, ...props }) => (
    <h5 className={cn("aui-md-h5", heading, className)} {...props} />
  ),
  h6: ({ className, ...props }) => (
    <h6 className={cn("aui-md-h6", heading, className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  // A citation is the only link the model is asked to write. Anything else is a
  // URL a user typed into their feedback, so it opens away from the thread too.
  a: ({ className, href, children, ...props }) => {
    const postId = href ? getCitedPostId(href) : null;

    if (postId) return <Citation postId={postId} />;

    // `urlTransform` empties any href it will not vouch for — a `javascript:`
    // URL, or a citation whose id is malformed. Rendering those as text rather
    // than as an anchor keeps them from looking clickable and from navigating
    // the admin off the page when clicked.
    if (!href) return <>{children}</>;

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "aui-md-a font-medium underline underline-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote text-muted-foreground my-3 border-l-2 pl-3 italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        // A GFM task list item brings its own checkbox, so it does not want a
        // bullet in front of it as well.
        "aui-md-ul my-3 ml-5 list-disc [&>li]:mt-1 [&>li:has(input)]:list-none",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("aui-md-ol my-3 ml-5 list-decimal [&>li]:mt-1", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("aui-md-hr my-4", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-3 w-full border-separate border-spacing-0 text-xs",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-2.5 py-1.5 text-left font-semibold first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-b border-l px-2.5 py-1.5 text-left last:border-r [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre bg-muted mb-3 overflow-x-auto rounded-b-lg p-3 text-xs",
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code bg-muted rounded border px-1 py-0.5 text-[0.85em]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
