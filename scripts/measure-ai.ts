import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  connectionChat,
  connectionText,
  outputTokens,
} from "../lib/ai-request-limits";
import { calibrationClient } from "../lib/llm/client";
import {
  checkImage,
  validateConnectionReply,
} from "../lib/llm/connection-check";
import { OPENROUTER_API } from "../lib/llm/constants";
import { parseLabels } from "../lib/llm/content";
import {
  moderatePrompt,
  moderationInput,
  rewritePrompt,
  titlePrompt,
  titleReview,
} from "../lib/llm/content-prompts";
import { defaults, privacyRouting } from "../lib/llm/defaults";
import { postEmbeddingText } from "../lib/llm/embeddings";
import type { VisionAsset } from "../lib/llm/input-budgets";
import {
  calibrationWidth,
  measureSearchDistances,
  searchCutoff,
  verifyCalibrationDatabase,
} from "./ai-calibration-search";
import {
  releaseFixtures,
  sha256,
  type ModerationFixture,
} from "./ai-release-fixtures";
import { command } from "./e2e/run";
import { releaseRequestShapes, runReleaseShape } from "./ai-release-shapes";

class MeasurementError extends Error {}

const price = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i)
      .transform(Number),
  ])
  .pipe(z.number().min(0));
const name = z.string().regex(/^[A-Za-z0-9._:/ -]{1,128}$/);
const keyInfo = z.object({
  data: z.object({
    limit: z.number().positive(),
    limit_remaining: z.number().positive(),
    limit_reset: z.null(),
    is_free_tier: z.literal(false),
    include_byok_in_limit: z.literal(true),
    is_management_key: z.boolean().optional(),
    is_provisioning_key: z.boolean().optional(),
  }),
});
const catalogueData = z.object({ data: z.array(z.unknown()) });
const candidateEntry = z.object({
  id: name,
  canonical_slug: name.optional(),
  context_length: z.number().int().min(128000),
  architecture: z.object({
    input_modalities: z.array(z.string()),
    output_modalities: z.array(z.string()),
  }),
  pricing: z.object({ prompt: price, completion: price, request: price }),
});
const embeddingEntry = z.object({
  id: name,
  pricing: z.object({ prompt: price, request: price }),
});

const finiteAmount = (value: unknown) => price.safeParse(value).data ?? null;
const tokenCount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

export function assertCalibrationKey(value: unknown, maxUsd: number) {
  const info = keyInfo.safeParse(value);
  if (
    !info.success ||
    info.data.data.limit > maxUsd ||
    info.data.data.is_management_key ||
    info.data.data.is_provisioning_key
  )
    throw new MeasurementError(
      "Use a funded inference key with a non-resetting limit at or below --max-usd and BYOK included in the limit",
    );
}

async function readMetadata(
  path: string,
  key: string,
  transport: typeof fetch,
) {
  const response = await transport(OPENROUTER_API + path, {
    headers: { authorization: "Bearer " + key },
    redirect: "error",
    signal: AbortSignal.timeout(defaults.timeoutMs),
  });
  const reader = response.body?.getReader();
  if (!reader)
    throw new MeasurementError("OpenRouter metadata response has no body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if (!response.ok)
      throw new MeasurementError("OpenRouter metadata request failed");
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 4 * 1024 * 1024)
        throw new MeasurementError("OpenRouter metadata exceeds 4 MiB");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

type Attempt = {
  case: string;
  requestedModel: string;
  state: "started" | "passed" | "failed";
  servedModel?: string;
  provider?: string;
  httpStatus?: number | null;
  reason?: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  elapsedMs?: number;
};
type Candidate = {
  model: string;
  version?: string;
  comparisonQuoteUsd: number;
  prices: z.infer<typeof candidateEntry>["pricing"];
  screening: { id: string; expected: string; actual: string }[];
  titles: {
    id: string;
    heading?: string;
    expectedCategory: string;
    category?: string;
    screened: boolean;
    passed: boolean;
  }[];
  eligible: boolean;
  averagePostChatUsd: number | null;
};

type Fixtures = Awaited<ReturnType<typeof releaseFixtures>>;
function manifest(fixtures: Fixtures) {
  return {
    hashes: fixtures.hashes,
    selection: fixtures.selection.length,
    heldOut: fixtures.heldOut.length,
    search: fixtures.search.length,
    prompts: sha256(
      [
        moderatePrompt,
        titlePrompt,
        titleReview,
        rewritePrompt,
        connectionChat.system,
        ...releaseRequestShapes().map(({ input }) =>
          sha256(JSON.stringify(input)),
        ),
      ].join("\n"),
    ),
  };
}

export function chooseMeasuredCandidate(candidates: Candidate[]) {
  const qualified = candidates.filter((candidate) => candidate.eligible);
  if (qualified.some(({ averagePostChatUsd }) => averagePostChatUsd === null))
    throw new MeasurementError(
      "A qualified model has unknown post-workload cost",
    );
  return qualified.sort(
    (a, b) =>
      a.averagePostChatUsd! - b.averagePostChatUsd! ||
      a.model.localeCompare(b.model, "en"),
  )[0];
}

export function estimateEmbeddingCost(
  attempts: Pick<Attempt, "inputTokens" | "costUsd">[],
  listed: z.infer<typeof embeddingEntry>["pricing"] | undefined,
) {
  if (attempts.every((row) => row.costUsd !== null))
    return {
      total: attempts.reduce((sum, row) => sum + row.costUsd!, 0),
      source: "provider-reported" as const,
    };
  if (
    listed &&
    attempts.every((row) => row.costUsd !== null || row.inputTokens !== null)
  )
    return {
      total: attempts.reduce(
        (sum, row) =>
          sum +
          (row.costUsd ?? row.inputTokens! * listed.prompt + listed.request),
        0,
      ),
      source: "reported-and-listed-token-prices" as const,
    };
  return null;
}

type Bounds = { maxUsd: number; maxRequests: number; maxCandidates: number };
type MeasureOptions = {
  key: string;
  sourceCommit: string;
  date: string;
  bounds: Bounds;
  fixtures: Fixtures;
  transport?: typeof fetch;
  distances?: typeof measureSearchDistances;
  checkpoint: (report: unknown) => Promise<void>;
};

export async function measureRelease({
  key,
  sourceCommit,
  date,
  bounds,
  fixtures,
  checkpoint,
  transport = fetch,
  distances = measureSearchDistances,
}: MeasureOptions) {
  const report = {
    status: "incomplete",
    error: undefined as string | undefined,
    date,
    sourceCommit,
    bounds,
    privacy: privacyRouting("deny"),
    fixtureManifest: manifest(fixtures),
    candidates: [] as Candidate[],
    holdout: [] as Candidate["screening"],
    attempts: [] as Attempt[],
    catalogue: undefined as
      | {
          entries: number;
          eligible: number;
          excluded: {
            priceOrShape: number;
            route: number;
            modalities: number;
            zeroQuote: number;
            duplicates: number;
          };
        }
      | undefined,
    comparison:
      "Average reported title plus moderation cost per accepted text post. Vision qualification and image pricing are separate.",
    maximumShapes: [] as { id: string; passed: boolean }[],
    observedCostUsd: 0,
    paidRequests: 0,
    unpricedRequests: 0,
    result: undefined as object | undefined,
  };
  const safeName = (value: unknown) => {
    const field = name.safeParse(value).data;
    return field && !field.includes(key) && !/sk-or-|P07_PRIVATE_/i.test(field)
      ? field
      : undefined;
  };
  const heading = (value: string | undefined) =>
    value && !value.includes(key) && !/sk-or-|P07_PRIVATE_/i.test(value)
      ? value
      : undefined;
  const base = { ...defaults, privacy: "deny" as const };

  async function step<
    T extends {
      failure?: { status: number | null; reason: string };
      usage: { inputTokens?: number; outputTokens?: number; cost?: unknown };
      receipt?: { model: unknown; provider: unknown; byok: boolean };
    },
  >(
    caseId: string,
    requestedModel: string,
    call: (client: ReturnType<typeof calibrationClient>) => Promise<T>,
  ) {
    let row: Attempt | undefined;
    let stop: MeasurementError | undefined;
    const start = performance.now();
    const client = calibrationClient(key, async (input, init) => {
      if (
        row ||
        report.paidRequests >= bounds.maxRequests ||
        report.observedCostUsd >= bounds.maxUsd
      ) {
        stop = new MeasurementError(
          "The approved paid request or cost limit was reached",
        );
        throw stop;
      }
      row = {
        case: caseId,
        requestedModel,
        state: "started",
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
      };
      report.attempts.push(row);
      report.paidRequests++;
      report.unpricedRequests++;
      await checkpoint(report);
      init?.signal?.throwIfAborted();
      return transport(input, init);
    });
    const result = await call(client);
    if (row) {
      row.state = result.failure ? "failed" : "passed";
      row.reason = result.failure?.reason;
      row.httpStatus = result.failure?.status;
      row.elapsedMs = Math.round(performance.now() - start);
      row.servedModel = safeName(result.receipt?.model);
      row.provider = safeName(result.receipt?.provider);
      row.inputTokens = tokenCount(result.usage.inputTokens);
      row.outputTokens = tokenCount(result.usage.outputTokens);
      row.costUsd = finiteAmount(result.usage.cost);
      if (row.costUsd !== null) {
        report.observedCostUsd += row.costUsd;
        report.unpricedRequests--;
      }
      await checkpoint(report);
    }
    if (stop) throw stop;
    if (result.receipt?.byok)
      throw new MeasurementError(
        "The fixture account routed a request through BYOK",
      );
    if (result.failure && [401, 402, 429].includes(result.failure.status ?? 0))
      throw new MeasurementError(
        "OpenRouter stopped measurement with HTTP " + result.failure.status,
      );
    return { ...result, attempt: row };
  }

  const options = (model: string) => ({ ...base, model });
  async function screen(
    model: string,
    test: ModerationFixture,
    title?: string,
  ) {
    let images: VisionAsset[] = [];
    if (test.stratum === "vision" && test.media) {
      const bytes = fixtures.media.get(test.media)!;
      images = [
        {
          id: test.media,
          contentType: "image/png",
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
          byteSize: bytes.length,
          load: async () => bytes,
        },
      ];
    }
    const input = moderationInput(test.text, title);
    const run = (suffix: string, vision: VisionAsset[]) =>
      step(test.id + suffix, model, (client) =>
        client.chat("moderation", input, options(model), { images: vision }),
      );
    let moderated = await run(title ? "/heading-screen" : "/screen", images);
    if (images.length && moderated.failure?.reason === "provider-input")
      moderated = await run("/fallback", []);
    const verdict = moderated.value?.moderation;
    const actual =
      moderated.failure?.reason === "provider-refusal" ||
      (verdict?.isInappropriate && verdict.confidenceScore > 0.7)
        ? "refuse"
        : verdict
          ? "allow"
          : "unavailable";
    return {
      outcome: { id: test.id, expected: test.verdict, actual },
      approved: verdict?.titleApproved === true,
      cost: moderated.attempt?.costUsd ?? null,
    };
  }

  async function embed(
    caseId: string,
    text: string,
    feature: "embed-query" | "embed-write" | "check",
  ) {
    const result = await step(caseId, base.embeddingModel, (client) =>
      client.embedding(feature, text, base, calibrationWidth),
    );
    if (!result.value || !result.attempt)
      throw new MeasurementError(
        "Default embedding model did not pass the production vector checks",
      );
    return { vector: result.value, attempt: result.attempt };
  }

  try {
    assertCalibrationKey(
      await readMetadata("/key", key, transport),
      bounds.maxUsd,
    );
    const rows = catalogueData.parse(
      await readMetadata("/models/user", key, transport),
    ).data;
    const excluded = {
      priceOrShape: 0,
      route: 0,
      modalities: 0,
      zeroQuote: 0,
      duplicates: 0,
    };
    const catalogue = new Map<string, z.infer<typeof candidateEntry>>();
    for (const raw of rows) {
      const entry = candidateEntry.safeParse(raw).data;
      if (!entry || !safeName(entry.id)) excluded.priceOrShape++;
      else if (entry.id.startsWith("openrouter/") || entry.id.endsWith(":free"))
        excluded.route++;
      else if (
        !entry.architecture.input_modalities.includes("text") ||
        !entry.architecture.input_modalities.includes("image") ||
        !entry.architecture.output_modalities.includes("text")
      )
        excluded.modalities++;
      else if (
        entry.pricing.prompt +
          entry.pricing.completion +
          entry.pricing.request ===
        0
      )
        excluded.zeroQuote++;
      else if (catalogue.has(entry.id)) excluded.duplicates++;
      else catalogue.set(entry.id, entry);
    }
    const quote = ({ pricing }: z.infer<typeof candidateEntry>) =>
      400 * pricing.prompt + 120 * pricing.completion + pricing.request;
    const eligible = [...catalogue.values()].sort(
      (a, b) => quote(a) - quote(b) || a.id.localeCompare(b.id, "en"),
    );
    report.catalogue = {
      entries: rows.length,
      eligible: eligible.length,
      excluded,
    };
    const examples = fixtures.selection.filter((test) => test.category);
    for (const model of eligible.slice(0, bounds.maxCandidates)) {
      const candidate: Candidate = {
        model: model.id,
        version: safeName(model.canonical_slug),
        comparisonQuoteUsd: quote(model),
        prices: model.pricing,
        screening: [],
        titles: [],
        eligible: false,
        averagePostChatUsd: null,
      };
      report.candidates.push(candidate);
      for (const test of fixtures.selection) {
        candidate.screening.push((await screen(model.id, test)).outcome);
        await checkpoint(report);
      }
      if (
        candidate.screening.some(({ expected, actual }) => expected !== actual)
      )
        continue;
      const costs: number[] = [];
      for (const test of examples) {
        const title = await step(test.id + "/title", model.id, (client) =>
          client.chat(
            "title",
            { system: titlePrompt, text: test.text },
            options(model.id),
            { validateText: parseLabels },
          ),
        );
        const fields = title.value?.value;
        const proposed = heading(fields?.title);
        const observation = {
          id: test.id,
          heading: proposed,
          expectedCategory: test.category!,
          category: fields?.category ?? undefined,
          screened: false,
          passed: false,
        };
        candidate.titles.push(observation);
        // The heading is an observation even if the budget ends before it can
        // be screened. Checkpoint it before starting the next paid request.
        await checkpoint(report);
        if (!proposed) continue;
        const reviewed = await screen(model.id, test, proposed);
        observation.screened = reviewed.approved;
        observation.passed =
          fields?.category === test.category &&
          reviewed.approved &&
          reviewed.outcome.actual === "allow";
        if (title.attempt?.costUsd != null && reviewed.cost != null)
          costs.push(title.attempt.costUsd + reviewed.cost);
        await checkpoint(report);
      }
      candidate.eligible =
        candidate.titles.length === 20 &&
        candidate.titles.every((row) => row.passed);
      if (candidate.eligible && costs.length === 20)
        candidate.averagePostChatUsd =
          costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    }
    if (eligible.length > bounds.maxCandidates)
      throw new MeasurementError(
        "The candidate cap left comparable catalogue models unmeasured",
      );
    const chosen = chooseMeasuredCandidate(report.candidates);
    if (!chosen)
      throw new MeasurementError(
        "No comparable candidate passed selection within the approved limits",
      );

    for (const test of fixtures.heldOut) {
      report.holdout.push((await screen(chosen.model, test)).outcome);
      await checkpoint(report);
    }
    if (report.holdout.some(({ expected, actual }) => expected !== actual))
      throw new MeasurementError(
        "Held-out verdicts differ. Review the mismatch IDs before changing fixtures or candidates.",
      );

    const selected = options(chosen.model);
    const chatCheck = await step("diagnostic-chat", chosen.model, (client) =>
      client.chat("check", connectionChat, selected, {
        validateText: validateConnectionReply,
        images: [checkImage],
      }),
    );
    if (chatCheck.value?.value !== true)
      throw new MeasurementError(
        "The production vision connection check failed under deny routing",
      );
    for (const shape of releaseRequestShapes()) {
      const measured = await step(shape.id, chosen.model, (client) =>
        runReleaseShape(client, shape, selected),
      );
      const allowed = measured.value?.moderation;
      const passed =
        !!measured.attempt &&
        measured.attempt.inputTokens !== null &&
        measured.attempt.outputTokens !== null &&
        measured.attempt.costUsd !== null &&
        (shape.feature === "moderation"
          ? allowed?.isInappropriate === false
          : measured.value?.value === true);
      report.maximumShapes.push({ id: shape.id, passed });
      await checkpoint(report);
      if (!passed)
        throw new MeasurementError(
          "The selected model failed production request or usage checks for " +
            shape.id,
        );
    }
    const check = await embed("diagnostic-embedding", connectionText, "check");
    const pairs = [];
    for (const pair of fixtures.search) {
      const query = await embed(pair.id + "/query", pair.query, "embed-query");
      const document = await embed(
        pair.id + "/document",
        postEmbeddingText(pair.post, pair.post),
        "embed-write",
      );
      pairs.push({
        id: pair.id,
        expected: pair.expected,
        query: query.vector,
        document: document.vector,
      });
    }
    const search = searchCutoff(
      await distances(pairs),
      defaults.searchMaxDistance,
    );
    if (search.searchMaxDistance === null)
      throw new MeasurementError(
        "Related and unrelated pgvector distances overlap",
      );

    const embeddings = [];
    for (const { id, text } of examples) {
      const title = chosen.titles.find((row) => row.id === id)?.heading;
      if (!title)
        throw new MeasurementError(
          "A selected post is missing its reviewed title",
        );
      embeddings.push(
        (
          await embed(
            id + "/post-embedding",
            postEmbeddingText(title, text),
            "embed-write",
          )
        ).attempt,
      );
    }
    let listedPrice: z.infer<typeof embeddingEntry>["pricing"] | undefined;
    if (embeddings.some((row) => row.costUsd === null)) {
      const catalogue = catalogueData.parse(
        await readMetadata(
          "/models/user?output_modalities=embeddings",
          key,
          transport,
        ),
      );
      listedPrice = catalogue.data
        .map((data) => embeddingEntry.safeParse(data).data)
        .find((entry) => entry?.id === base.embeddingModel)?.pricing;
    }
    const embeddingCost = estimateEmbeddingCost(embeddings, listedPrice);
    report.result = {
      chatModel: chosen.model,
      currentDefaultChatModel: defaults.model,
      embeddingModel: base.embeddingModel,
      embeddingWidth: check.vector.length,
      search,
      // The vectors come from synthetic posts and are needed by the exact-image
      // board check. This private report is never a CI upload.
      searchVectors: pairs,
      outputTokens,
      priceSnapshot: embeddingCost
        ? {
            date,
            usdPer100TextPosts:
              (chosen.averagePostChatUsd! +
                embeddingCost.total / examples.length) *
              100,
            embeddingSource: embeddingCost.source,
            embeddingPrices: listedPrice,
          }
        : null,
      operatorReview: [
        "independent headings",
        "apply model and measured midpoint",
        "exact-image board search",
      ],
    };
    if (!embeddingCost)
      throw new MeasurementError(
        "Embedding costs and a usable price fallback are unavailable",
      );
    report.status = "measured";
  } catch (error) {
    report.error =
      error instanceof MeasurementError
        ? error.message
        : "Could not complete the authenticated provider measurement";
  }
  await checkpoint(report);
  return report;
}

function positive(
  value: string | undefined,
  ceiling: number,
  name: string,
  integer = false,
) {
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed > ceiling ||
    (integer && !Number.isSafeInteger(parsed))
  )
    throw new MeasurementError(
      name + " requires an explicit positive value within its bounds",
    );
  return parsed;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "manifest-only": { type: "boolean" },
      "max-usd": { type: "string" },
      "max-requests": { type: "string" },
      "max-candidates": { type: "string" },
    },
    strict: true,
  });
  const fixtures = await releaseFixtures();
  if (values["manifest-only"]) {
    console.log(JSON.stringify(manifest(fixtures), null, 2));
    return;
  }
  const bounds = {
    maxUsd: positive(values["max-usd"], 100, "--max-usd"),
    maxRequests: positive(values["max-requests"], 5000, "--max-requests", true),
    maxCandidates: positive(
      values["max-candidates"],
      100,
      "--max-candidates",
      true,
    ),
  };
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key)
    throw new MeasurementError(
      "Supply a dedicated capped OPENROUTER_API_KEY from your secret manager",
    );
  await verifyCalibrationDatabase();
  if (
    await command("git", ["status", "--porcelain", "--untracked-files=normal"])
  )
    throw new MeasurementError(
      "Run paid calibration from the exact clean commit you intend to qualify",
    );
  const sourceCommit = await command("git", ["rev-parse", "HEAD"]);
  const date = new Date().toISOString();
  const directory = "artifacts/self-hosting/live-ai";
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(
    directory,
    date.replaceAll(":", "-") + "-" + randomUUID().slice(0, 8) + ".json",
  );
  const temporary = file + ".tmp";
  const result = await measureRelease({
    key,
    sourceCommit,
    date,
    bounds,
    fixtures,
    checkpoint: async (report) => {
      await writeFile(temporary, JSON.stringify(report, null, 2) + "\n", {
        mode: 0o600,
      });
      await rename(temporary, file);
    },
  });
  console.log(result.status + " " + file);
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  void main().catch((error) => {
    console.error(
      error instanceof MeasurementError
        ? error.message
        : "Calibration preflight or evidence write failed",
    );
    process.exitCode = 1;
  });
