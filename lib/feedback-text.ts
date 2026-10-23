export const MAX_FEEDBACK_TEXT_LENGTH = 10_000;
// Post editing carries HTML: leave room for entities and editor markup while
// bounding the request independently of its decoded text content.
export const MAX_FEEDBACK_HTML_BYTES = 128_000;

export function escapeFeedbackText(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>");
}
