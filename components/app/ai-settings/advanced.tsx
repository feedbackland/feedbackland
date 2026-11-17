"use client";
import { useEffect, useRef, useState } from "react";
import { useTRPCClient } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import type { Options } from "@/lib/llm/defaults";
import { envNames } from "@/lib/ai-onboarding-copy";
import { largeRequestScenarios } from "@/lib/ai-cost-scenarios";
import { SearchIndex } from "@/app/(first-party)/admin/system/search-index";
import { useAiAdmin, type AiStatus } from "./status";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
type Catalogue = {
  id: string;
  inputPrice: string | null;
  outputPrice: string | null;
  vision: boolean | null;
};
const money = (cost: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(cost);

export function Advanced({ status: s }: { status: AiStatus }) {
  const api = useTRPCClient(),
    { perform, busy } = useAiAdmin(),
    [draft, setDraft] = useState<Partial<Options>>({}),
    [base, setBase] = useState(s.identity);
  const [lists, setLists] = useState<{
    chatModels: Catalogue[];
    embeddingModels: Catalogue[];
    at: string | null;
  }>({ chatModels: [], embeddingModels: [], at: null });
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState("");
  const currentToken = useRef(s.identity.token);
  useEffect(() => {
    currentToken.current = s.identity.token;
  }, [s.identity.token]);
  const dirty = Object.keys(draft).length > 0,
    stale = dirty && s.identity.token !== base.token;
  const field = (k: keyof Options) => draft[k] ?? s.options[k];
  const edit = <K extends keyof Options>(key: K, value: Options[K]) => {
    if (!dirty) setBase(s.identity);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };
  const locked = (k: keyof Options) => s.locked.includes(k);
  const note = (k: keyof Options) =>
    locked(k) ? <small>Set on the server by {envNames[k]}.</small> : null;
  const load = async () => {
    if (!s.canEnable || s.keptOffAt || loadedToken === s.identity.token) return;
    setPickerError("");
    try {
      const embeddings = await api.listAiModels.mutate({
        identity: s.identity,
        kind: "embeddingModels",
      });
      const chat = await api.listAiModels.mutate({
        identity: s.identity,
        kind: "chatModels",
      });
      if (currentToken.current === s.identity.token) {
        setLists({
          chatModels: chat.models,
          embeddingModels: embeddings.models,
          at: chat.at,
        });
        setLoadedToken(s.identity.token);
      }
    } catch {
      setPickerError("Live prices and available models could not be loaded.");
    }
  };
  const models =
    loadedToken === s.identity.token
      ? lists
      : { chatModels: [], embeddingModels: [], at: null };
  const save = async () => {
    const changed = Object.fromEntries(
      Object.entries(draft).filter(
        ([k, v]) => v !== s.options[k as keyof Options],
      ),
    );
    if (!Object.keys(changed).length) {
      setDraft({});
      return;
    }
    if (
      await perform(async () => {
        await api.saveAiOptions.mutate({ identity: base, options: changed });
      }, "AI settings saved.")
    )
      setDraft({});
  };
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Usage and limits</h2>
      <p>
        {s.budget.used} of {s.options.dailyCallLimit} ordinary model requests
        today. The last 20% is reserved for screening. Extra manual diagnostics
        used {s.budget.diagnostic} of 40. Both reset at{" "}
        {new Date(s.budget.resetAt).toLocaleTimeString()}.
      </p>
      <details
        id="limits"
        ref={(node) => {
          if (node && location.hash === "#limits") node.open = true;
        }}
        className="space-y-3 rounded-lg border p-4"
        onToggle={(e) => {
          if (e.currentTarget.open) void load();
        }}
      >
        <summary className="cursor-pointer font-semibold">
          Advanced settings and privacy
        </summary>
        <div className="grid max-w-xl gap-3">
          {(["model", "embeddingModel"] as const).map((k) => (
            <label className="grid gap-1" key={k}>
              {k === "model" ? "Chat model" : "Embedding model"}
              <input
                className="rounded border p-2"
                list={k + "-models"}
                value={String(field(k))}
                disabled={locked(k)}
                onChange={(e) => edit(k, e.target.value)}
              />
              <datalist id={k + "-models"}>
                {k === "embeddingModel" && <option value="none" />}
                {models[k === "model" ? "chatModels" : "embeddingModels"].map(
                  (m) => (
                    <option value={m.id} key={m.id}>
                      {m.inputPrice ?? "unknown"} USD/input token ·{" "}
                      {m.outputPrice ?? "unknown"} USD/output token
                    </option>
                  ),
                )}
              </datalist>
              {note(k)}
            </label>
          ))}
          {pickerError && (
            <p role="status">
              {pickerError}{" "}
              <button className="underline" onClick={() => void load()}>
                Reload model list
              </button>
            </p>
          )}
          <label className="grid gap-1">
            Provider privacy
            <select
              className="rounded border p-2"
              value={field("privacy") as string}
              disabled={locked("privacy")}
              onChange={(e) =>
                edit("privacy", e.target.value as Options["privacy"])
              }
            >
              <option value="deny">
                Only providers that do not train on prompts
              </option>
              <option value="zdr">Zero data retention</option>
              <option value="allow">Allow data collection</option>
            </select>
            {note("privacy")}
          </label>
          <p className="text-sm">
            Providers may retain prompts for abuse monitoring under the default
            policy. Strict retention restricts the eligible endpoints. Your{" "}
            <a
              className="underline"
              href="https://openrouter.ai/settings/privacy"
              target="_blank"
              rel="noreferrer"
            >
              OpenRouter privacy settings
            </a>{" "}
            also apply.
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(field("vision"))}
              onChange={(e) => edit("vision", e.target.checked)}
            />{" "}
            Screen eligible images with vision
          </label>
          {(
            [
              ["dailyCallLimit", "Daily model request limit", 10, 1000000, 1],
              ["timeoutMs", "Request timeout (ms)", 1000, 120000, 1],
              ["searchMaxDistance", "Maximum semantic distance", 0, 2, 0.01],
            ] as const
          ).map(([k, label, min, max, step]) => (
            <label className="grid gap-1" key={k}>
              {label}
              <input
                className="rounded border p-2"
                type="number"
                min={min}
                max={max}
                step={step}
                disabled={locked(k)}
                value={Number(field(k))}
                onChange={(e) => edit(k, Number(e.target.value))}
              />
              {note(k)}
            </label>
          ))}
          {stale && (
            <p role="alert">
              Another change was saved.{" "}
              <button className="underline" onClick={() => setDraft({})}>
                Reload settings
              </button>
            </p>
          )}
          <Button
            disabled={!dirty || busy || stale}
            onClick={() => void save()}
          >
            Save AI settings
          </Button>
        </div>
        <SearchIndex />
        <details>
          <summary>What is sent to OpenRouter</summary>
          <p>
            Screening and titles send new post or comment text. Screening may
            include up to two eligible images. Embeddings send bounded text for
            indexing and search. Ask AI sends the question, recent conversation
            and selected post text. Insights sends bounded batches of open
            posts. Connection checks use fixed samples.
          </p>
        </details>
        <details>
          <summary>Large-request scenario at listed prices</summary>
          <p>
            {models.at
              ? "Prices retrieved from OpenRouter on " +
                new Date(models.at).toLocaleDateString() +
                "."
              : "Live prices unavailable."}{" "}
            Chat estimates require a measured tokenizer and full routing,
            reasoning and image prices. Each insights chunk and its final merge
            consume a separate request.
          </p>
          <ul>
            {largeRequestScenarios(s.options.model, s.options.embeddingModel, [
              ...models.chatModels,
              ...models.embeddingModels,
            ]).map((row) => (
              <li key={row.feature}>
                {row.feature} · {row.model} · {row.shape} ·{" "}
                {row.cost === null ? "Estimate unavailable" : money(row.cost)}
              </li>
            ))}
          </ul>
        </details>
      </details>
      <Usage />
    </section>
  );
}
function Usage() {
  const trpc = useTRPC(),
    q = useQuery(
      trpc.getAiUsage.queryOptions(undefined, { refetchInterval: 30000 }),
    ),
    [period, setPeriod] = useState("today");
  const rows = q.data?.usage.filter((r) => r.period === period) ?? [];
  const month = q.data?.usage.filter((r) => r.period === "30days") ?? [];
  const costPerCall = (feature: string) => {
    const row = month.find((r) => r.feature === feature);
    return row && Number(row.calls) > 0 && Number(row.uncosted) === 0
      ? Number(row.cost) / Number(row.calls)
      : null;
  };
  const screening = costPerCall("moderation"),
    title = costPerCall("title"),
    embedding = costPerCall("embed-write");
  const perPost =
    screening !== null && title !== null && embedding !== null
      ? screening + title + embedding
      : null;
  const typical = perPost === null ? null : 100 * perPost;
  const activity = q.data?.activity;
  const projected =
    activity && perPost !== null && screening !== null && embedding !== null
      ? activity.posts * perPost + activity.comments * (screening + embedding)
      : null;
  return (
    <div className="space-y-2">
      <label>
        Usage period{" "}
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">Today (UTC)</option>
          <option value="month">This month</option>
          <option value="30days">Last 30 days</option>
        </select>
      </label>
      {q.isError ? (
        <p role="alert">Could not read usage.</p>
      ) : !q.data ? (
        <p>Loading usage…</p>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Feature",
                  "Calls",
                  "Errors",
                  "Input tokens",
                  "Output tokens",
                  "Reported cost",
                  "Missing prices",
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td>{r.feature}</td>
                  <td>{r.calls}</td>
                  <td>{r.errors}</td>
                  <td>{r.input}</td>
                  <td>{r.output}</td>
                  <td>
                    {Number(r.calls) === Number(r.uncosted)
                      ? "Unknown"
                      : money(Number(r.cost))}
                  </td>
                  <td>{r.uncosted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No requests recorded in this period.</p>
      )}
      {q.data && (
        <p>
          Last 30 days: {q.data.activity.posts} posts and{" "}
          {q.data.activity.comments} discussion comments. Typical cost per 100
          text posts:{" "}
          {typical === null
            ? "estimate unavailable"
            : money(typical) +
              " using this board’s reported average for one screening, title and embedding call per post"}
          .{" "}
          {activity && activity.posts > 0 && (
            <>
              At that activity level, screening and indexing posts and comments
              and titling each post would cost{" "}
              {projected === null
                ? "an unknown amount"
                : "about " + money(projected)}{" "}
              at this board’s last 30 days of reported per-call prices.{" "}
            </>
          )}
          Set a spend limit on the key to cap the bill in dollars.
        </p>
      )}
    </div>
  );
}
