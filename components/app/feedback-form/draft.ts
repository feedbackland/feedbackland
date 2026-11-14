import { escapeFeedbackText } from "@/lib/feedback-text";
import { imageId } from "@/lib/images/path";
export function draftText(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const br of template.content.querySelectorAll("br"))
    br.replaceWith("\n");
  for (const block of template.content.querySelectorAll(
    "p,div,li,blockquote,pre,h1,h2,h3,h4,h5,h6",
  ))
    block.append("\n");
  return template.content.textContent?.trim() ?? "";
}
export function applyDraftText(html: string, text: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const images = Array.from(template.content.querySelectorAll("img")).filter(
    (img) => imageId(img.getAttribute("src") ?? ""),
  );
  return (
    "<p>" +
    escapeFeedbackText(text) +
    "</p>" +
    images.map((img) => img.outerHTML).join("")
  );
}
