import "server-only";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
import { parse, NodeType, type Node } from "node-html-parser";
import { DomainError } from "./domain-error";
import { isStatusLabel } from "./feedback-status";
import { isBlockedContentLink } from "./safe-content-link";
import { imageId, imageUrl } from "./images/path";
import { getConfig } from "./config";
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
export function validateDatabaseText(text: string) {
  if (text.includes("\u0000") || !text.isWellFormed())
    throw new ContentInputError("INVALID_CONTENT_INPUT");
}
export function plainTextContent(text: string) {
  validateDatabaseText(text);
  if (text.length > MAX_FEEDBACK_TEXT_LENGTH)
    throw new ContentInputError("Feedback exceeds the text length limit");
  if (!text.trim()) throw new ContentInputError("Content is empty");
  const content = escapeFeedbackText(text);
  const plainText = getPlainText(content);
  if (!plainText) throw new ContentInputError("Content is empty");
  return { content, plainText, imageIds: [] as string[] };
}
export function clean(html: string, images?: Set<string>) {
  return sanitizeHtml(html, {
    transformTags: {
      img(tagName, attribs) {
        const src = (attribs.src ?? "").trim();
        if (
          images &&
          /^(?:data|blob):/i.test(src.replace(/[\u0000-\u0020]+/g, ""))
        )
          throw new ContentInputError(
            "Wait for the attachment to finish uploading or re-attach it.",
          );
        const id = imageId(src);
        if (!id) return { tagName: "img", attribs: {} };
        images?.add(id);
        const attributes: Record<string, string> = { src: imageUrl(id) };
        for (const key of ["width", "height"])
          if (
            /^[1-9]\d{0,4}$/.test(attribs[key] ?? "") &&
            Number(attribs[key]) <= 10000
          )
            attributes[key] = attribs[key];
        return { tagName, attribs: attributes };
      },
      a(tagName, attribs) {
        return isBlockedContentLink(attribs.href ?? "", getConfig().appUrl)
          ? { tagName: "span", attribs: {} }
          : { tagName, attribs };
      },
      span(tagName, attribs) {
        const label = attribs["data-label"];
        if (attribs["data-type"] === "status" && label && !isStatusLabel(label))
          return { tagName, attribs: {}, text: label };
        return { tagName, attribs };
      },
    },
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["span", "img"]),
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "width", "height"],
      span: ["data-type", "data-id", "data-label"],
    },
    allowedClasses: { span: ["mention"] },
  });
}
export function getPlainText(html: string) {
  return convert(clean(html), {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  })
    .replace(/\s+/g, " ")
    .trim();
}
export function textContent(
  html: string,
  maxBytes = 48_000,
  maxTextLength = Infinity,
) {
  validateDatabaseText(html);
  if (
    Buffer.byteLength(html, "utf8") > maxBytes ||
    /<\s*(svg|video|audio|iframe|object)\b/i.test(html)
  )
    throw new ContentInputError(`Content up to ${maxBytes} bytes is required`);
  const ids = new Set<string>();
  const content = clean(html, ids);
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
  if (!plainText && !ids.size) throw new ContentInputError("Content is empty");
  return { content, plainText, imageIds: [...ids] };
}
export function feedbackPostHtmlContent(html: string) {
  return textContent(html, MAX_FEEDBACK_HTML_BYTES, MAX_FEEDBACK_TEXT_LENGTH);
}
