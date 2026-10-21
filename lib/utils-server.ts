import "server-only";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
export class ContentInputError extends Error {}
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
