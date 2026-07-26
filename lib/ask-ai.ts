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

export const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const UUID_EXACT = new RegExp(`^${UUID_PATTERN}$`, "i");

/**
 * Every shape a model plausibly writes a citation in.
 *
 * The prompt asks for one — a markdown link — but the model answering here is a
 * small, fast one, and the difference between "cited" and "not cited" is the
 * difference between an answer the admin can act on and one they cannot. So the
 * bar for being understood is low: name the scheme and the id, in a link, in
 * brackets, in parentheses, or on its own. Anything carrying a real id counts.
 *
 * `normaliseCitations` folds all of them into the link form, so everything
 * downstream — the gap rule, the renderer, the source list, the copy button —
 * only ever has one shape to deal with.
 */
const CITATION_FORMS = new RegExp(
  [
    // [7](post:id) — what the prompt asks for.
    `\\[[^\\]\\n]{0,40}\\]\\(\\s*${CITATION_SCHEME}\\s*(${UUID_PATTERN})\\s*\\)`,
    // [[post:id]] or (post:id) and the single-bracket variants.
    `\\[{1,2}\\s*${CITATION_SCHEME}\\s*(${UUID_PATTERN})\\s*\\]{1,2}`,
    `\\(\\s*${CITATION_SCHEME}\\s*(${UUID_PATTERN})\\s*\\)`,
    // A bare token.
    `${CITATION_SCHEME}\\s*(${UUID_PATTERN})`,
  ].join("|"),
  "gi",
);

const citedId = (groups: (string | undefined)[]) =>
  groups.find((group) => !!group)?.toLowerCase() ?? null;

/**
 * Citation-shaped markup carrying something that is not a post id — the model
 * writing out a placeholder, or an id it mangled. Markdown will not even parse
 * `[1](post:<the id>)` as a link, so left alone it sits in the answer as raw
 * punctuation. The claim it was attached to is still the model's claim; it just
 * goes uncited.
 */
const MALFORMED_CITATION = new RegExp(
  `[ \\t]*\\[[^\\]\\n]{0,40}\\]\\(\\s*${CITATION_SCHEME}(?!\\s*${UUID_PATTERN}\\s*\\))[^)\\n]{0,60}\\)`,
  "gi",
);

/** Rewrites every recognised citation into the one canonical link form. */
export const normaliseCitations = (text: string) =>
  text
    .replace(CITATION_FORMS, (match, ...rest) => {
      const id = citedId(rest.slice(0, 4) as (string | undefined)[]);
      return id ? `[1](${CITATION_SCHEME}${id})` : match;
    })
    .replace(MALFORMED_CITATION, "");

/** The post id a citation link points at, or null if it points somewhere else. */
export const getCitedPostId = (href: string): string | null => {
  if (!href.toLowerCase().startsWith(CITATION_SCHEME)) return null;
  const id = href.slice(CITATION_SCHEME.length).trim().toLowerCase();
  return UUID_EXACT.test(id) ? id : null;
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

  for (const match of text.matchAll(CITATION_FORMS)) {
    const id = citedId(match.slice(1, 5));
    if (id) seen.add(id);
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

  return normaliseCitations(text).replace(
    new RegExp(`\\]\\(${CITATION_SCHEME}(${UUID_PATTERN})\\)`, "gi"),
    (_match, postId: string) => `](${platformUrl}/${postId})`,
  );
};
