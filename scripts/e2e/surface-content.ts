import assert from "node:assert/strict";
import { clean, textContent } from "../../lib/utils-server";
for (const label of [
  "planned fixed inset-0",
  "__proto__",
  "constructor",
  "<img src=x onerror=alert(1)>",
]) {
  const result = clean(
    `<span data-type="status" data-label="${label}">old</span>`,
  );
  assert.doesNotMatch(result, /data-label|class=|<img/);
  assert.equal(textContent(result).plainText, label);
}
assert.match(
  clean('<span data-type="status" data-label="planned">Planned</span>'),
  /data-label="planned"/,
);
console.log(
  "surface content: exact status allowlist and inert invalid-label text passed",
);
