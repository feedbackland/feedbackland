/**
 * Shared between the chat route and the Ask AI page, so the number the welcome
 * screen promises is the number the model is actually given.
 */

/**
 * How many posts go into a single answer, newest first.
 *
 * The board is read whole below this; above it the oldest posts are left out and
 * both the prompt and the welcome screen say so. 300 posts of plain text is
 * roughly 45k tokens — well inside the model's window, and cheap enough to
 * re-send on every turn, which is what keeps the corpus one fixed set the page
 * can describe instead of whatever a search happened to return.
 */
export const ASK_AI_MAX_POSTS = 300;

/** Long descriptions are cut here; the model is told they may be. */
export const ASK_AI_MAX_DESCRIPTION_CHARS = 400;

/**
 * Citations are markdown links with our own scheme, so they survive streaming,
 * degrade to a plain link if anything goes wrong with the renderer, and never
 * collide with a real URL a user might have written in a post.
 */
export const CITATION_SCHEME = "post:";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const CITATION_PATTERN = new RegExp(`\\(${CITATION_SCHEME}(${UUID})\\)`, "gi");

/** The post id a citation link points at, or null if it points somewhere else. */
export const getCitedPostId = (href: string): string | null => {
  if (!href.toLowerCase().startsWith(CITATION_SCHEME)) return null;
  const id = href.slice(CITATION_SCHEME.length).trim().toLowerCase();
  return new RegExp(`^${UUID}$`, "i").test(id) ? id : null;
};

/**
 * Every post cited in an answer, in the order it is first cited — which is the
 * order the sources are numbered in.
 *
 * Read off the message text rather than accumulated as the links render, so the
 * inline numbers and the list below the answer are always derived from the same
 * thing and cannot disagree.
 */
export const extractCitedPostIds = (text: string): string[] => {
  const seen = new Set<string>();

  for (const match of text.matchAll(CITATION_PATTERN)) {
    seen.add(match[1].toLowerCase());
  }

  return [...seen];
};

/**
 * An answer copied out of the page goes into a ticket or a message, where our
 * own scheme means nothing. Rewriting each citation to the post's real URL
 * leaves the prose exactly as written and the numbered references working
 * wherever it lands.
 */
export const rewriteCitationsForCopy = (
  text: string,
  platformUrl: string | null,
): string => {
  if (!platformUrl) return text;

  return text.replace(
    new RegExp(`\\]\\(${CITATION_SCHEME}(${UUID})\\)`, "gi"),
    (_match, postId: string) => `](${platformUrl}/${postId})`,
  );
};
