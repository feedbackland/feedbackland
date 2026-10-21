import "server-only";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
import { DomainError } from "./domain-error";
import { escapeFeedbackText, MAX_FEEDBACK_TEXT_LENGTH } from "./feedback-text";
export class ContentInputError extends DomainError {
  constructor(message: string) {
    super("BAD_REQUEST", message);
  }
}
export function plainTextContent(text: string) {
  if (text.length > MAX_FEEDBACK_TEXT_LENGTH)
    throw new ContentInputError("Feedback exceeds the text length limit");
  if (!text.trim()) throw new ContentInputError("Content is empty");
  const content = escapeFeedbackText(text);
  return { content, plainText: getPlainText(content) };
}
export function clean(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["span"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      span: ["data-type", "data-id", "data-label"],
    },
    allowedClasses: { span: ["mention"] },
  });
}
export function getPlainText(html: string) {
  return convert(clean(html), {
    wordwrap: false,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  })
    .replace(/\s+/g, " ")
    .trim();
}
export function textContent(html: string) {
  if (
    Buffer.byteLength(html, "utf8") > 48_000 ||
    /<\s*(img|svg|video|audio|iframe|object)\b/i.test(html)
  )
    throw new ContentInputError(
      "Text-only content up to 48000 bytes is required",
    );
  const content = clean(html),
    plainText = getPlainText(content);
  if (!plainText) throw new ContentInputError("Content is empty");
  return { content, plainText };
}
