"use client";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Citation } from "@/components/app/ask-ai/citations";
import { getCitedPostId } from "@/lib/ask-ai";
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
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      urlTransform={urlTransform}
      preprocess={closeCitationGaps}
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

/**
 * Models put a space before a citation about half the time, which leaves the
 * superscript floating between two sentences instead of attached to the one it
 * supports. Closing the gap here fixes it every time, where asking nicely in the
 * prompt fixes it most of the time.
 *
 * Spaces and tabs only: a citation the model put on its own line stays there.
 */
const CITATION_GAP = /[ \t]+(?=\[[^\]]*\]\(post:)/gi;

const closeCitationGaps = (text: string) => text.replace(CITATION_GAP, "");

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
      className={cn("aui-md-ul my-3 ml-5 list-disc [&>li]:mt-1", className)}
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
        "aui-md-th bg-muted px-2.5 py-1.5 text-left font-semibold first:rounded-tl-lg last:rounded-tr-lg [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-b border-l px-2.5 py-1.5 text-left last:border-r [&[align=center]]:text-center [&[align=right]]:text-right",
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
