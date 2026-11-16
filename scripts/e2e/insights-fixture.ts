import assert from "node:assert/strict";
import { chat, type Handler } from "../mock-llm";

export function insightRequest(body: Record<string, unknown>) {
  assert.equal(body.max_tokens, 4096);
  const messages = body.messages as { role: string; content: string }[];
  assert.deepEqual(
    messages.map((m) => m.role),
    ["system", "user"],
  );
  const [system, input] = messages.map((m) => m.content);
  assert(Buffer.byteLength(system) + Buffer.byteLength(input) <= 64000);
  const items = JSON.parse(input) as {
    id: number;
    index: number;
    title: string;
    description: string;
    category?: string;
  }[];
  assert(items.length <= 200);
  const merge = system.startsWith("Find summaries");
  if (!merge) {
    assert(system.startsWith("Group related feedback"));
    items.forEach((item, i) => {
      assert.deepEqual(Object.keys(item).sort(), [
        "category",
        "description",
        "id",
        "title",
      ]);
      assert.equal(item.id, i + 1);
      assert(Array.from(item.description).length <= 700);
    });
  } else items.forEach((item, i) => assert.equal(item.index, i));
  return { items, merge };
}
export const insightAnswer: Handler = ({ body, response }) => {
  const { items, merge } = insightRequest(body);
  const result = merge
    ? { groups: items.length > 1 ? [items.map((p) => p.index)] : [] }
    : {
        insights: [
          {
            title: "Improve board navigation",
            description: "Make feedback easier to find.",
            evidence: "People requested easier navigation.",
            severity: 65,
            effort: "m",
            confidence: 0.9,
            ids: items.map((p) => p.id),
          },
        ],
      };
  chat(response, 0.001, "stop", JSON.stringify(result));
};
