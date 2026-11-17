import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const directory = "scripts/fixtures";
const labels = z.enum(["idea", "issue", "general feedback"]);
const verdict = z.enum(["allow", "refuse"]);
const fixture = z
  .object({
    id: z.string().regex(/^(select|validate)-\d{3}$/),
    language: z.string().regex(/^[a-z]{2}$/),
    text: z.string().trim().min(12),
    category: labels.optional(),
    verdict,
    stratum: z.string().min(1),
    rationale: z.string().min(10),
    media: z
      .string()
      .regex(/^[a-z-]+\.(png|gif)$/)
      .optional(),
  })
  .strict();
const pair = z
  .object({
    id: z.string().regex(/^pair-\d{2}$/),
    expected: z.enum(["related", "unrelated"]),
    query: z.string().min(10).max(200),
    post: z.string().min(10),
  })
  .strict();
export type ModerationFixture = z.infer<typeof fixture>;

export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const hash = (data: unknown) => sha256(JSON.stringify(data));

export async function releaseFixtures() {
  const read = async (file: string) =>
    JSON.parse(await readFile(join(directory, file), "utf8"));
  const [rawSelection, rawHeldOut, rawSearch] = await Promise.all([
    read("moderation-corpus.json"),
    read("moderation-held-out.json"),
    read("search-corpus.json"),
  ]);
  const selection = fixture.array().parse(rawSelection);
  const heldOut = fixture.array().parse(rawHeldOut);
  const search = pair.array().parse(rawSearch);
  const submissions = [...selection, ...heldOut];
  for (const kind of verdict.options) {
    assert.equal(selection.filter((test) => test.verdict === kind).length, 20);
    assert(heldOut.filter((test) => test.verdict === kind).length >= 40);
  }
  assert(
    selection.every(
      (row) =>
        row.id.startsWith("select-") &&
        !row.media &&
        !!row.category === (row.verdict === "allow"),
    ),
  );
  assert(
    heldOut.every((row) => row.id.startsWith("validate-") && !row.category),
  );
  assert.equal(
    new Set(submissions.map((row) => row.id)).size,
    submissions.length,
  );
  assert.equal(
    new Set(submissions.map((row) => normalize(row.text))).size,
    submissions.length,
  );
  assert(new Set(heldOut.map((row) => row.language)).size >= 8);
  for (const stratum of [
    "vision",
    "text-fallback",
    "multilingual",
    "instruction",
    "obfuscated",
  ]) {
    for (const kind of verdict.options)
      assert(
        heldOut.some((row) => row.stratum === stratum && row.verdict === kind),
      );
  }
  assert(
    heldOut.some(
      (row) => row.stratum === "criticism" && row.verdict === "allow",
    ),
  );
  assert(
    heldOut.some(
      (row) => row.stratum === "provider-refusal" && row.verdict === "refuse",
    ),
  );
  assert.equal(new Set(search.map((row) => row.id)).size, search.length);
  for (const kind of ["related", "unrelated"])
    assert(search.filter((row) => row.expected === kind).length >= 10);
  const media = new Map<string, Buffer>();
  for (const row of heldOut) {
    if (row.stratum === "vision") assert(row.media?.endsWith(".png"));
    else if (row.stratum === "text-fallback")
      assert(row.media?.endsWith(".gif"));
    else assert.equal(row.media, undefined);
    if (!row.media || media.has(row.media)) continue;
    const bytes = await readFile(
      join(directory, "moderation-media", row.media),
    );
    assert(bytes.length > 0 && bytes.length <= 1_000_000);
    const png = row.media.endsWith(".png");
    assert.equal(
      bytes.toString("hex", 0, png ? 8 : 4),
      png ? "89504e470d0a1a0a" : "47494638",
    );
    if (png)
      assert(bytes.readUInt32BE(16) * bytes.readUInt32BE(20) <= 4_000_000);
    media.set(row.media, bytes);
  }
  return {
    selection,
    heldOut,
    search,
    media,
    hashes: {
      selection: hash(rawSelection),
      heldOut: hash(rawHeldOut),
      search: hash(rawSearch),
      media: Object.fromEntries(
        Array.from(media.entries(), ([file, bytes]) => [file, sha256(bytes)]),
      ),
    },
  };
}
