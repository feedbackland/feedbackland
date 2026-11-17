import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  connectionChat,
  connectionText,
  outputTokens,
} from "../lib/ai-request-limits";
import { OPENROUTER_API } from "../lib/llm/constants";
import { defaults, privacyRouting } from "../lib/llm/defaults";
import {
  moderatePrompt,
  titlePrompt,
  titleReview,
} from "../lib/llm/content-prompts";
import {
  releaseFixtures,
  sha256,
  type ModerationFixture,
} from "./ai-release-fixtures";
import { command } from "./e2e/run";

class MeasurementError extends Error {}
const nonnegative = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i)
      .transform(Number),
  ])
  .pipe(z.number().min(0));
const name = z.string().regex(/^[a-zA-Z0-9._:/ -]{1,128}$/);
const catalogue = z.object({
  data: z.array(
    z.object({
      id: name,
      canonical_slug: name.optional(),
      context_length: z.number().int().optional().nullable(),
      architecture: z.object({
        input_modalities: z.array(z.string()),
        output_modalities: z.array(z.string()).optional(),
      }),
      pricing: z.object({
        prompt: nonnegative,
        completion: nonnegative,
        request: nonnegative,
      }),
    }),
  ),
});
const usageSchema = z.object({
  prompt_tokens: z.number().int().min(0).optional(),
  completion_tokens: z.number().int().min(0).optional(),
  cost: nonnegative.optional(),
});
const chatSchema = z.object({
  model: name,
  provider: name.optional(),
  usage: usageSchema,
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({ content: z.string().nullable() }),
      }),
    )
    .length(1),
});
const titleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((s) => s.isWellFormed() && !/[\u0000-\u001f\u007f]/.test(s)),
  category: z.enum(["idea", "issue", "general feedback"]),
});
const verdictSchema = z.object({
  isInappropriate: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  titleApproved: z.boolean().optional(),
});
const embeddings = z.object({
  model: name,
  usage: usageSchema,
  data: z.array(
    z.object({
      index: z.number().int().min(0),
      embedding: z.array(z.number()).length(768),
    }),
  ),
});
function parsedJson(text: string | null) {
  try {
    return JSON.parse(
      text?.trim().replace(/^`{3}(?:json)?\s*([\s\S]*?)\s*`{3}$/i, "$1") ?? "",
    );
  } catch {
    return null;
  }
}
function validName(value: string | undefined) {
  return value && (value.includes("sk-or-") || value.includes("P07_PRIVATE_"))
    ? undefined
    : value;
}
function positiveOption(
  value: string | undefined,
  ceiling: number,
  setting: string,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > ceiling)
    throw new MeasurementError(
      setting + " requires a positive explicit value within its allowed range",
    );
  return parsed;
}
async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new MeasurementError("OpenRouter returned no body");
  let bytes = 0;
  const chunks: Buffer[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 4 * 1024 * 1024)
        throw new MeasurementError("OpenRouter response exceeds 4 MiB");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new MeasurementError(
      "OpenRouter response is unreadable or exceeds 4 MiB",
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
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
  const fixtureManifest = {
    hashes: fixtures.hashes,
    selection: fixtures.selection.length,
    heldOut: fixtures.heldOut.length,
    search: fixtures.search.length,
    prompts: sha256([moderatePrompt, titlePrompt, titleReview].join("\n")),
  };
  if (values["manifest-only"]) {
    console.log(JSON.stringify(fixtureManifest, null, 2));
    return;
  }
  const maxUsd = positiveOption(values["max-usd"], 100, "--max-usd");
  const maxRequests = positiveOption(
    values["max-requests"],
    5000,
    "--max-requests",
  );
  const maxCandidates = positiveOption(
    values["max-candidates"],
    100,
    "--max-candidates",
  );
  if (
    !Number.isSafeInteger(maxRequests) ||
    !Number.isSafeInteger(maxCandidates)
  )
    throw new MeasurementError(
      "Request and candidate limits must be whole numbers",
    );
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key)
    throw new MeasurementError(
      "Supply a dedicated capped OPENROUTER_API_KEY in the shell environment",
    );

  const date = new Date().toISOString();
  const sourceCommit = await command("git", ["rev-parse", "HEAD"]);
  const bounds = { maxUsd, maxRequests, maxCandidates };
  const privacy = privacyRouting("deny");
  const candidates: object[] = [];
  const holdout: object[] = [];
  const report = {
    status: "incomplete",
    error: "" as string | undefined,
    date,
    sourceCommit,
    fixtureManifest,
    privacy,
    bounds,
    candidates,
    holdout,
    result: undefined as object | undefined,
    paidRequests: 0,
    observedCostUsd: 0,
    unpricedRequests: 0,
  };
  type Path = "/key" | "/models/user" | "/chat/completions" | "/embeddings";
  async function request(path: Path, body?: unknown) {
    if (body && ++report.paidRequests > maxRequests) {
      report.paidRequests--;
      throw new MeasurementError("Maximum paid request count reached");
    }
    const response = await fetch(OPENROUTER_API + path, {
      method: body ? "POST" : "GET",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    return { status: response.status, body: await readJson(response) };
  }
  function account(usage?: z.infer<typeof usageSchema>) {
    if (usage?.cost === undefined) report.unpricedRequests++;
    else report.observedCostUsd += usage.cost;
    if (report.observedCostUsd >= maxUsd)
      throw new MeasurementError("Reported cost reached the approved budget");
    return usage;
  }

  async function complete(
    model: string,
    system: string,
    text: string,
    maximum: number,
    image?: string,
  ) {
    const { status, body } = await request("/chat/completions", {
      model,
      provider: privacy,
      response_format: { type: "json_object" },
      reasoning: { effort: "minimal" },
      max_tokens: maximum,
      usage: { include: true },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: image
            ? [
                { type: "text", text },
                { type: "image_url", image_url: { url: image } },
              ]
            : text,
        },
      ],
    });
    if (status === 402 || status === 401 || status === 429)
      throw new MeasurementError(
        "OpenRouter stopped measurement with HTTP " + status,
      );
    if (status !== 200) {
      const err = z
        .object({
          error: z.object({
            metadata: z.object({ error_type: z.string() }).optional(),
          }),
          usage: usageSchema.optional(),
        })
        .safeParse(body);
      const type = err.data?.error.metadata?.error_type;
      return {
        status,
        value: null,
        refused:
          status === 403 &&
          (type === "content_policy_violation" || type === "refusal"),
        usage: account(err.data?.usage),
      };
    }
    const result = chatSchema.safeParse(body);
    if (!result.success) {
      account();
      return { status, value: null, refused: false };
    }
    const {
      choices: [choice],
      usage,
      provider,
      model: servedModel,
    } = result.data;
    return {
      status,
      value:
        choice.finish_reason === "stop"
          ? parsedJson(choice.message.content)
          : null,
      refused: choice.finish_reason === "content_filter",
      usage: account(usage),
      servedModel: validName(servedModel),
      provider: validName(provider),
    };
  }

  async function moderate(
    model: string,
    test: ModerationFixture,
    heading?: string,
  ) {
    const image =
      test.stratum === "vision" && test.media
        ? "data:image/png;base64," +
          fixtures.media.get(test.media)!.toString("base64")
        : undefined;
    const { value, refused, ...details } = await complete(
      model,
      heading ? moderatePrompt + titleReview : moderatePrompt,
      heading ? test.text + "\n\nProposed heading:\n" + heading : test.text,
      outputTokens.moderation,
      image,
    );
    const verdict = verdictSchema.safeParse(value);
    const actual =
      refused ||
      (verdict.data?.isInappropriate && verdict.data.confidenceScore > 0.7)
        ? "refuse"
        : verdict.success
          ? "allow"
          : "unavailable";
    return {
      id: test.id,
      expected: test.verdict,
      actual,
      passed:
        actual === test.verdict &&
        (!heading || verdict.data?.titleApproved === true),
      ...details,
    };
  }
  const embeddingModel = defaults.embeddingModel;
  async function embed(text: string[]) {
    const { status, body } = await request("/embeddings", {
      model: embeddingModel,
      provider: privacy,
      dimensions: 768,
      encoding_format: "float",
      input: text,
    });
    const result = embeddings.safeParse(body);
    if (status !== 200 || !result.success)
      throw new MeasurementError(
        "Default embedding model did not return 768 finite values per input",
      );
    const ordered = [...result.data.data].sort((a, b) => a.index - b.index);
    if (
      ordered.length !== text.length ||
      ordered.some(
        (row, i) =>
          row.index !== i ||
          !row.embedding.every(Number.isFinite) ||
          Math.hypot(...row.embedding) === 0,
      )
    )
      throw new MeasurementError(
        "Default embedding response is incomplete or invalid",
      );
    return {
      values: ordered.map((row) => row.embedding),
      usage: account(result.data.usage),
      model: validName(result.data.model),
    };
  }
  try {
    const current = await request("/key");
    const accountInfo = z
      .object({
        data: z.object({
          limit: z.number().positive().max(maxUsd),
          limit_remaining: z.number().positive(),
          limit_reset: z.null(),
          is_free_tier: z.literal(false),
          is_management_key: z.boolean().optional(),
          is_provisioning_key: z.boolean().optional(),
        }),
      })
      .safeParse(current.body);
    if (
      current.status !== 200 ||
      !accountInfo.success ||
      accountInfo.data.data.is_management_key ||
      accountInfo.data.data.is_provisioning_key
    )
      throw new MeasurementError(
        "The key must be a funded inference key with a non-resetting spend cap at or below --max-usd",
      );

    const listed = await request("/models/user");
    const parsed = catalogue.safeParse(listed.body);
    // Individual catalogue entries with unknown prices cannot support a price comparison.
    const root = z
      .object({ data: z.array(z.unknown()) })
      .safeParse(listed.body);
    if (listed.status !== 200 || !root.success)
      throw new MeasurementError(
        "The authenticated model catalogue is unavailable",
      );
    const modelSchema = catalogue.shape.data.element;
    const known = parsed.success
      ? parsed.data.data
      : root.data.data.flatMap((raw) => {
          const row = modelSchema.safeParse(raw);
          return row.success ? [row.data] : [];
        });
    const eligible = known.filter(
      ({ id, architecture, pricing, context_length }) =>
        !!validName(id) &&
        !id.startsWith("openrouter/") &&
        !id.endsWith(":free") &&
        !!context_length &&
        context_length >= 128000 &&
        architecture.input_modalities.includes("text") &&
        architecture.input_modalities.includes("image") &&
        architecture.output_modalities?.includes("text") &&
        pricing.prompt + pricing.completion + pricing.request > 0,
    );
    // Put the same reference workload through every quote when deciding what to test first.
    const quote = ({ pricing }: (typeof eligible)[number]) =>
      400 * pricing.prompt + 120 * pricing.completion + pricing.request;
    eligible.sort(
      (a, b) => quote(a) - quote(b) || a.id.localeCompare(b.id, "en"),
    );
    let chosen: (typeof eligible)[number] | undefined;
    let postCosts: number[] = [];
    for (const model of eligible.slice(0, maxCandidates)) {
      const screening = [];
      for (const test of fixtures.selection)
        screening.push(await moderate(model.id, test));
      const titles = [];
      const costs = [];
      if (screening.every((test) => test.passed)) {
        for (const test of fixtures.selection.filter((test) => test.category)) {
          const { value, refused, ...details } = await complete(
            model.id,
            titlePrompt,
            test.text,
            outputTokens.title,
          );
          const label = titleSchema.safeParse(value);
          const reviewed = label.success
            ? await moderate(model.id, test, label.data.title)
            : null;
          const passed =
            !refused &&
            label.data?.category === test.category &&
            !!reviewed?.passed;
          titles.push({
            id: test.id,
            expected: test.category,
            actual: label.data?.category ?? null,
            passed,
            reviewed,
            ...details,
          });
          if (
            details.usage?.cost !== undefined &&
            reviewed?.usage?.cost !== undefined
          )
            costs.push(details.usage.cost + reviewed.usage.cost);
        }
      }
      candidates.push({
        model: model.id,
        version: validName(model.canonical_slug),
        quoteUSD: quote(model),
        quoteInputs: { inputTokens: 400, outputTokens: 120, requests: 1 },
        prices: model.pricing,
        modelCatalogueEntries: root.data.data.length,
        comparableCatalogueEntries: eligible.length,
        screening,
        titles,
      });
      if (titles.length === 20 && titles.every((test) => test.passed)) {
        chosen = model;
        postCosts = costs;
        break;
      }
    }
    if (!chosen)
      throw new MeasurementError(
        "No comparable candidate passed selection within the approved limits",
      );
    const allowed = [];
    for (const test of fixtures.heldOut) {
      const outcome = await moderate(chosen.id, test);
      holdout.push(outcome);
      allowed.push(outcome.passed);
    }
    if (allowed.includes(false))
      throw new MeasurementError(
        "Held-out regression verdicts differ. Review the mismatch IDs before changing fixtures or candidates.",
      );

    const fixedImage =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNsaGhgwAaYsIoOWgkAMBcBkGHHl6YAAAAASUVORK5CYII=";
    const { value: checked, ...chatCheck } = await complete(
      chosen.id,
      connectionChat.system,
      connectionChat.text,
      outputTokens.check,
      fixedImage,
    );
    if (!z.object({ ok: z.literal(true) }).safeParse(checked).success)
      throw new MeasurementError(
        "The vision connection check did not pass under deny routing",
      );
    const {
      values: [sample],
      ...embeddingCheck
    } = await embed([connectionText]);
    const { values: vectors, ...searchCheck } = await embed(
      fixtures.search.flatMap(({ query, post }) => [query, post]),
    );
    const searchDistances = fixtures.search.map(({ id, expected }, i) => {
      const a = vectors[i * 2],
        b = vectors[i * 2 + 1];
      const dot = a.reduce((sum, v, n) => sum + v * b[n], 0);
      return {
        id,
        expected,
        distance: 1 - dot / (Math.hypot(...a) * Math.hypot(...b)),
      };
    });
    const worstRelated = Math.max(
      ...searchDistances
        .filter((p) => p.expected === "related")
        .map((p) => p.distance),
    );
    const closestUnrelated = Math.min(
      ...searchDistances
        .filter((p) => p.expected === "unrelated")
        .map((p) => p.distance),
    );
    const searchMaxDistance = (worstRelated + closestUnrelated) / 2;
    const matchCurrentCutoff =
      defaults.searchMaxDistance >= worstRelated &&
      defaults.searchMaxDistance < closestUnrelated;
    const postEmbedding = await embed(
      fixtures.selection
        .filter((test) => test.category)
        .map((test) => test.text),
    );
    const embeddingCost = postEmbedding.usage?.cost;
    const typicalPostUsd =
      postCosts.length === 20 && embeddingCost !== undefined
        ? (postCosts.reduce((sum, value) => sum + value, 0) + embeddingCost) /
          20
        : null;
    report.result = {
      chatModel: chosen.id,
      currentDefaultChatModel: defaults.model,
      chatCheck,
      embeddingModel,
      embeddingCheck: { width: sample.length, ...embeddingCheck },
      search: {
        ...searchCheck,
        distances: searchDistances,
        worstRelated,
        closestUnrelated,
        searchMaxDistance,
        matchCurrentCutoff,
      },
      postEmbedding: { model: postEmbedding.model, usage: postEmbedding.usage },
      observedPriceSnapshot:
        typicalPostUsd === null
          ? null
          : { date, usdPer100TextPosts: typicalPostUsd * 100 },
      outputTokens,
    };
    if (worstRelated >= closestUnrelated)
      throw new MeasurementError(
        "Related and unrelated distance distributions overlap",
      );
    if (typicalPostUsd === null)
      throw new MeasurementError(
        "The provider omitted usage costs needed for the dated post-price snapshot",
      );
    report.status = "measured";
    report.error = undefined;
  } catch (error) {
    report.error =
      error instanceof MeasurementError
        ? error.message
        : "Could not complete the authenticated provider measurement";
    process.exitCode = 1;
  }
  const directory = "artifacts/self-hosting/live-ai";
  await mkdir(directory, { recursive: true });
  const file = join(directory, date.replaceAll(":", "-") + ".json");
  await writeFile(file, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(report.status + " " + file);
  if (report.error) console.error(report.error);
}

void main().catch((error) => {
  console.error(
    error instanceof MeasurementError
      ? error.message
      : "Provide valid measurement options and run from the repository root",
  );
  process.exitCode = 1;
});
