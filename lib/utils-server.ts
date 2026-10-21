import "server-only";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
import { parse, NodeType, type Node } from "node-html-parser";
import { DomainError } from "./domain-error";
import {
  escapeFeedbackText,
  MAX_FEEDBACK_TEXT_LENGTH,
  MAX_FEEDBACK_HTML_BYTES,
} from "./feedback-text";
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
  const plainText = getPlainText(content);
  if (!plainText) throw new ContentInputError("Content is empty");
  return { content, plainText };
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
export function textContent(
  html: string,
  maxBytes = 48_000,
  maxTextLength = Infinity,
) {
  if (
    Buffer.byteLength(html, "utf8") > maxBytes ||
    /<\s*(img|svg|video|audio|iframe|object)\b/i.test(html)
  )
    throw new ContentInputError(
      `Text-only content up to ${maxBytes} bytes is required`,
    );
  const content = clean(html);
  const pending: Array<{ node: Node; depth: number }> = [
    { node: parse(content), depth: 0 },
  ];
  let length = 0;
  // Traverse iteratively: bounded HTML can still contain deeply nested tags.
  // Decode each text node; a <br> counts like the escaped create-path newline.
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth > 100)
      throw new ContentInputError("Content nesting exceeds the limit");
    if (node.nodeType === NodeType.TEXT_NODE) length += node.textContent.length;
    else {
      if ("rawTagName" in node && node.rawTagName === "br") length++;
      for (const child of node.childNodes)
        pending.push({ node: child, depth: depth + 1 });
    }
    if (length > maxTextLength)
      throw new ContentInputError("Feedback exceeds the text length limit");
  }
  // Validate nesting before html-to-text's recursive conversion.
  const plainText = getPlainText(content);
  if (!plainText) throw new ContentInputError("Content is empty");
  return { content, plainText };
}
export function feedbackPostHtmlContent(html: string) {
  return textContent(html, MAX_FEEDBACK_HTML_BYTES, MAX_FEEDBACK_TEXT_LENGTH);
}
