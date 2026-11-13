import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { EMBED_HEADER } from "../../lib/embed-surface";
import { proxy } from "../../proxy";

for (const query of [
  "",
  "?embed=x",
  "?embed=x&embed=drawer",
  "?embed=drawer&embed=x",
]) {
  const response = proxy(
    new NextRequest(`http://fixture.invalid/${query}`, {
      headers: { [EMBED_HEADER]: "spoofed" },
    }),
  );
  assert.equal(
    response.headers.get(`x-middleware-request-${EMBED_HEADER}`),
    query.includes("drawer") ? "drawer" : "first-party",
  );
  if (query.includes("drawer"))
    assert.equal(
      response.headers.get("content-security-policy"),
      "frame-ancestors *",
    );
  assert.equal(
    proxy(new NextRequest(`http://fixture.invalid/admin${query}`)).headers.get(
      "content-security-policy",
    ),
    null,
  );
}
for (const site of ["cross-site", "same-site", "none"]) {
  const response = proxy(
    new NextRequest("http://fixture.invalid/auth/popup?ticket=fixture", {
      headers: { "sec-fetch-site": site },
    }),
  );
  assert.equal(response.status, 400);
}
const previous = process.env.RECOVERY_CODE;
const query = new URLSearchParams({
  provider: "oidc",
  ticket: "a".repeat(32),
  h: "b".repeat(64),
  mode: "embedded",
});
assert.equal(
  proxy(new NextRequest("http://fixture.invalid/auth/popup?" + query)).status,
  200,
);
query.append("ticket", "c".repeat(32));
assert.equal(
  proxy(new NextRequest("http://fixture.invalid/auth/popup?" + query)).status,
  404,
);
delete process.env.RECOVERY_CODE;
try {
  assert.equal(
    proxy(new NextRequest("http://fixture.invalid/recover")).status,
    404,
  );
} finally {
  if (previous === undefined) delete process.env.RECOVERY_CODE;
  else process.env.RECOVERY_CODE = previous;
}
console.log(
  "Proxy: any-match surface, private framing, popup GET guard and disabled recovery 404 passed",
);
