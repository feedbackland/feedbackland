import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Runs inside the isolated production container after setup, with no AI key.
const origin = "http://localhost:3000";
let cookie;
function submit(path, body) {
  return fetch(origin + path, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify(body),
  });
}
async function mutate(name, input) {
  const response = await submit("/api/trpc/" + name, { json: input });
  assert.equal(response.status, 200, name);
  const row = (await response.json()).result.data.json;
  assert.equal(row.moderationState, "disabled", name);
  return row;
}
const anonymous = await submit("/api/feedback/create", {
  description: "Keyless public fixture",
});
assert.equal(anonymous.status, 201);
assert.match((await anonymous.json()).id, /^[a-f0-9-]{36}$/);
const signup = await submit("/api/auth/sign-up/email", {
  name: "Keyless fixture",
  email: randomUUID() + "@fixture.invalid",
  password: randomUUID(),
});
assert.equal(signup.status, 200);
cookie = signup.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");
assert(cookie);
const post = await mutate("createFeedbackPost", {
  description: "Keyless signed fixture",
});
const comment = await mutate("createComment", {
  postId: post.id,
  parentCommentId: null,
  content: "Keyless reply",
});
await mutate("updateFeedbackPost", {
  postId: post.id,
  expectedRevision: post.revision,
  title: "Updated",
  description: "Edited post",
});
await mutate("updateComment", {
  commentId: comment.id,
  expectedRevision: comment.revision,
  content: "Edited reply",
});
const rewrite = await submit("/api/trpc/rewriteFeedback", {
  json: { description: "Keyless draft" },
});
assert.equal(rewrite.status, 412);
assert.equal((await rewrite.json()).error.json.message, "AI_NOT_CONFIGURED");
