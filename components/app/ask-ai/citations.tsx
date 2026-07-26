"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFeedbackPostsByIds } from "@/hooks/use-feedback-posts-by-ids";
import { usePlatformUrl } from "@/hooks/use-platform-url";

/**
 * The posts an answer cites, numbered.
 *
 * An answer the admin cannot check is an answer they cannot act on — the same
 * rule the insights evidence panel is built on. Here it means every claim the
 * model makes about the feedback carries a link to the post it came from.
 *
 * Two things are deliberate. The numbering is ours, not the model's: it is
 * assigned in order of first appearance so an answer always reads 1, 2, 3
 * whatever the model wrote in the link text. And the titles are read from the
 * database rather than from the answer, so what a citation claims to point at is
 * what it actually points at — and an id the model made up resolves to nothing
 * and disappears instead of becoming a broken link.
 */

type Citations = {
  /** Post id to its number in this answer. Absent means "do not render". */
  numbers: Map<string, number>;
  titles: Map<string, string>;
  /** Post ids in citation order, once they are known to be real posts. */
  order: string[];
  resolved: boolean;
  /** Null only until the board's own URL is known, which needs the window. */
  platformUrl: string | null;
};

/**
 * A citation with nowhere to point is rendered as a `span`, not as an `a` with
 * no `href`. React does not patch mismatched attributes when it hydrates — it
 * only replaces mismatched elements — so an anchor whose href exists on the
 * client but not on the server would keep the server's hrefless version and
 * quietly stop being a link. Changing the tag makes the difference one React
 * will actually fix.
 */
function PostLink({
  platformUrl,
  postId,
  className,
  children,
  ...rest
}: {
  platformUrl: string | null;
  postId: string;
  className: string;
  children: ReactNode;
} & Pick<React.ComponentProps<"a">, "aria-label">) {
  if (!platformUrl) {
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={`${platformUrl}/${postId}`}
      target="_blank"
      rel="noreferrer"
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}

const CitationsContext = createContext<Citations | null>(null);

const EMPTY_IDS: string[] = [];

export function CitationsProvider({
  postIds,
  /**
   * Resolution waits for the answer to finish. Looking posts up while the text
   * is still streaming would fire a query for every token that adds a citation.
   */
  isComplete,
  children,
}: {
  postIds: string[];
  isComplete: boolean;
  children: ReactNode;
}) {
  const platformUrl = usePlatformUrl();

  const {
    query: { data: posts },
  } = useFeedbackPostsByIds({
    ids: isComplete ? postIds : EMPTY_IDS,
    enabled: isComplete,
  });

  const value = useMemo<Citations>(() => {
    const titles = new Map<string, string>();
    for (const post of posts ?? []) titles.set(post.id, post.title);

    // Before the posts are back, everything the model cited is numbered so the
    // answer reads correctly as it streams. After, only what really exists is —
    // which is what keeps the list below the answer gap-free.
    const resolved = !!posts;
    const order = resolved ? postIds.filter((id) => titles.has(id)) : postIds;

    return {
      numbers: new Map(order.map((id, index) => [id, index + 1])),
      titles,
      order,
      resolved,
      platformUrl,
    };
  }, [posts, postIds, platformUrl]);

  return (
    <CitationsContext.Provider value={value}>
      {children}
    </CitationsContext.Provider>
  );
}

/**
 * The superscript number in the answer. Opens in a new tab: reading a source is
 * the main reason to click anything on this page, and it must not cost the
 * conversation.
 */
export function Citation({ postId }: { postId: string }) {
  const citations = useContext(CitationsContext);
  const number = citations?.numbers.get(postId);

  if (!citations || !number) return null;

  const title = citations.titles.get(postId);

  const link = (
    <PostLink
      platformUrl={citations.platformUrl}
      postId={postId}
      aria-label={title ? `Source ${number}: ${title}` : `Source ${number}`}
      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-sm px-1 align-super text-[10px] font-medium tabular-nums no-underline transition-colors"
    >
      {number}
    </PostLink>
  );

  if (!title) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The posts behind the answer, in the order they were cited.
 *
 * Titles only. What a post says, who upvoted it and where it stands are all one
 * click away on the post itself; repeating any of it here would turn a
 * three-line footnote into a second answer.
 */
export function CitationSources() {
  const citations = useContext(CitationsContext);

  if (!citations?.resolved || citations.order.length === 0) return null;

  return (
    <div className="border-border mt-4 border-t pt-3">
      <p className="text-muted-foreground mb-1.5 text-xs font-medium">
        Sources
      </p>
      <ol className="space-y-1">
        {citations.order.map((id, index) => (
          <li key={id} className="flex items-baseline gap-2 text-xs">
            <span className="text-muted-foreground w-3 shrink-0 text-right tabular-nums">
              {index + 1}
            </span>
            <PostLink
              platformUrl={citations.platformUrl}
              postId={id}
              className="min-w-0 truncate leading-snug hover:underline"
            >
              {citations.titles.get(id)}
            </PostLink>
          </li>
        ))}
      </ol>
    </div>
  );
}
