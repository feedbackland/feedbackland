export const ASK_AI_SESSION_HEADER = "x-feedbackland-chat-session";
export const ASK_AI_MAX_POSTS = 300;
export const ASK_AI_MAX_DESCRIPTION_CHARS = 400;
export const ASK_AI_QUESTION_BYTES = 4000;
export const ASK_AI_HISTORY_BYTES = 16000;
export const ASK_AI_HISTORY_TURNS = 8;
export const ASK_AI_STREAM_MS = 180_000;

const encoder = new TextEncoder();
export const askAiBytes = (text: string) => encoder.encode(text).length;
export const askAiQuestionTooLong = (text: string) =>
  askAiBytes(text.trim()) > ASK_AI_QUESTION_BYTES;

type ChatTurn = {
  role: "user" | "assistant";
  parts: { type: "text"; text: string }[];
};

export function askAiTextTurns(
  messages: readonly {
    role: string;
    parts: readonly { type: string; text?: string }[];
  }[],
) {
  const turns: ChatTurn[] = [];
  const newest = messages.at(-1);
  if (newest?.role !== "user") return turns;
  const textOf = (message: (typeof messages)[number]) =>
    message.parts
      .flatMap((part) =>
        part.type === "text" && typeof part.text === "string"
          ? [part.text]
          : [],
      )
      .join("")
      .toWellFormed();
  let room = ASK_AI_HISTORY_BYTES;
  for (const turn of messages
    .slice(-(ASK_AI_HISTORY_TURNS + 1), -1)
    .reverse()) {
    if (turn.role !== "user" && turn.role !== "assistant") continue;
    let bytes = 0;
    let end = 0;
    const content = textOf(turn);
    for (const point of content) {
      const size = askAiBytes(point);
      if (bytes + size > Math.min(ASK_AI_QUESTION_BYTES, room)) break;
      bytes += size;
      end += point.length;
    }
    const text = content.slice(0, end);
    if (text.trim()) {
      turns.unshift({ role: turn.role, parts: [{ type: "text", text }] });
      room -= bytes;
    }
    if (!room) break;
  }
  const question = textOf(newest).trim();
  if (askAiQuestionTooLong(question)) throw new Error("INVALID_CHAT_INPUT");
  turns.push({ role: "user", parts: [{ type: "text", text: question }] });
  return turns;
}

export type AskAiScope = {
  sourceIds: string[];
  more: boolean;
  truncated?: boolean;
};

export function askAiScope(metadata: unknown): AskAiScope | undefined {
  if (!metadata || typeof metadata !== "object" || !("scope" in metadata))
    return;
  const scope = metadata.scope;
  if (!scope || typeof scope !== "object") return;
  const value = scope as Partial<AskAiScope>;
  if (
    typeof value.more !== "boolean" ||
    !Array.isArray(value.sourceIds) ||
    value.sourceIds.length > ASK_AI_MAX_POSTS ||
    value.sourceIds.some((id) => typeof id !== "string" || !UUID_EXACT.test(id))
  )
    return;
  return value as AskAiScope;
}

export function askAiErrorCopy(error: unknown, locale?: string) {
  let code: unknown = typeof error === "string" ? error : undefined;
  let resumes: string | undefined;
  if (typeof code === "string" && code.startsWith("{")) {
    try {
      const body = JSON.parse(code) as { error?: unknown; resetsAt?: unknown };
      code = body.error;
      if (typeof body.resetsAt === "string" && body.resetsAt.length <= 30) {
        const date = new Date(body.resetsAt);
        if (Number.isFinite(date.getTime()))
          resumes = date.toLocaleTimeString(locale);
      }
    } catch {
      code = undefined;
    }
  }
  switch (code) {
    case "AI_PAUSED":
      return {
        text: resumes
          ? "Paused until " + resumes + "."
          : "The board has reached its daily AI allowance.",
        settings: "Raise the daily limit",
      };
    case "AI_NOT_CONFIGURED":
      return {
        text: "Ask AI is off for this board.",
        settings: "Open AI settings",
      };
    case "AI_BUSY":
      return { text: "Ask AI is busy. Try again shortly." };
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return { text: "Sign in again as a board administrator." };
    case "INVALID_CHAT_INPUT":
    case "BODY_TOO_LARGE":
      return { text: "Shorten your question and try again." };
    case "REQUEST_CANCELLED":
      return { text: "The answer was stopped." };
    default:
      return {
        text: "The model could not complete the answer.",
        settings: "Open AI settings",
      };
  }
}

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
export const extractCitedPostIds = (
  text: string,
  sourceIds: readonly string[],
): string[] => {
  const allowed = new Set(sourceIds);
  const seen = new Set<string>();

  for (const match of text.matchAll(CITATION_FORMS)) {
    const id = citedId(match.slice(1, 5));
    if (id && allowed.has(id)) seen.add(id);
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
  appUrl: string | null,
  sourceIds: readonly string[],
): string => {
  const allowed = new Set(sourceIds);
  return normaliseCitations(text).replace(
    new RegExp(
      "\\[1\\]\\(" + CITATION_SCHEME + "(" + UUID_PATTERN + ")\\)",
      "gi",
    ),
    (_match, postId: string) =>
      allowed.has(postId) && appUrl ? "[1](" + appUrl + "/" + postId + ")" : "",
  );
};
