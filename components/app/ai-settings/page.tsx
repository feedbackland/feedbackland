"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@/providers/trpc-client";
import { useSettings } from "@/providers/settings";
import { Button } from "@/components/ui/button";
import {
  aiSettingsPath,
  issueText,
  keyProblem,
} from "@/lib/ai-onboarding-copy";
import { AiNextAction, statusLabel, useAiAdmin } from "./status";
import { Advanced } from "./advanced";

function SecretField({
  label,
  onSubmit,
  autoFocus = false,
  unsecured = false,
}: {
  label: string;
  onSubmit: (value: string) => Promise<void>;
  autoFocus?: boolean;
  unsecured?: boolean;
}) {
  const field = useRef<HTMLInputElement>(null),
    { busy } = useAiAdmin();
  useEffect(() => {
    if (!autoFocus || busy) return;
    const next = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(next);
  }, [autoFocus, busy]);
  const submit = (value: string) => {
    if (field.current) field.current.value = "";
    if (value.trim()) void onSubmit(value.trim());
  };
  return (
    <form
      className="max-w-lg space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(field.current?.value ?? "");
      }}
    >
      <label className="grid gap-1">
        {label}
        <input
          className="rounded border px-3 py-2"
          ref={field}
          type="password"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          onPaste={(e) => {
            e.preventDefault();
            submit(e.clipboardData.getData("text"));
          }}
        />
      </label>
      <p className="text-muted-foreground text-sm">
        Only paste a key or code you created yourself, just now. Nobody from
        Feedbackland or OpenRouter will send you one.
      </p>
      {unsecured && (
        <p className="text-sm">
          This page uses plain HTTP. A pasted key travels unencrypted. You can
          use Connect OpenRouter or set the key on the server.
        </p>
      )}
      <Button size="sm" disabled={busy} type="submit">
        Submit {label.toLowerCase()}
      </Button>
    </form>
  );
}
export function AiSettingsPage() {
  const {
      status: s,
      unavailable,
      busy,
      change,
      connect,
      perform,
      alternate,
    } = useAiAdmin(),
    api = useTRPCClient(),
    router = useRouter(),
    params = useSearchParams(),
    board = useSettings();
  const welcome = params.get("welcome") === "1",
    flow = params.get("flow");
  const [problem, setProblem] = useState(""),
    [keyInfo, setKeyInfo] = useState<{
      token: string;
      limit: number | null;
      remaining: number | null;
      expiresAt: string | null;
    } | null>(null);
  const [keyInfoFailed, setKeyInfoFailed] = useState(false);
  const token = s?.identity.token,
    revision = s?.identity.revision,
    active =
      s?.enabled === true ||
      (s?.keySource === "environment" && s.enabled !== false);
  const checkedDetails =
    s?.check?.spendLimit !== undefined &&
    s.budget.now.getTime() - Date.parse(s.check.at) < 15 * 60_000;
  useEffect(() => {
    if (!token || !revision || !active || checkedDetails) return;
    let ignore = false;
    void api.getAiKeyInfo
      .mutate({ token, revision })
      .then((data) => {
        if (!ignore && data) {
          setKeyInfo({ token, ...data });
          setKeyInfoFailed(false);
        }
      })
      .catch(() => {
        if (!ignore) setKeyInfoFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [api, token, revision, active, checkedDetails]);
  const credit = s?.state === "credit";
  useEffect(() => {
    if (!credit || !token || !revision) return;
    let running = false;
    const poll = async () => {
      if (document.hidden || !navigator.onLine || running) return;
      running = true;
      try {
        await api.changeAiKey.mutate({
          action: "credit",
          identity: { token, revision },
        });
        window.dispatchEvent(new Event("feedbackland-settings"));
      } catch {
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void poll(), 15000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [api, credit, token, revision]);
  if (!s)
    return (
      <p role="status">
        {unavailable
          ? "AI settings are temporarily unavailable."
          : "Loading AI settings…"}
      </p>
    );
  const origin = new URL(board.appUrl),
    publicHttps =
      origin.protocol === "https:" &&
      origin.hostname !== "localhost" &&
      board.allowIndexing;
  const paste = async (key: string) => {
    const error = keyProblem(key);
    setProblem(error ?? "");
    if (error) return;
    await perform(async () => {
      await api.pasteAiKey.mutate({ identity: s.identity, key });
    });
  };
  const pasteCode = async (code: string) => {
    if (!flow) return;
    if (
      await perform(async () => {
        await api.finishOpenRouter.mutate({
          mode: "headless",
          nonce: flow,
          code,
        });
      })
    )
      router.replace(aiSettingsPath);
  };
  const details =
    checkedDetails && s.check
      ? {
          limit: s.check.spendLimit,
          remaining: s.check.remaining,
          expiresAt: s.check.expiresAt,
        }
      : keyInfo?.token === token
        ? keyInfo
        : null;
  return (
    <main className="max-w-3xl space-y-6">
      <nav aria-label="Settings sections" className="flex gap-4">
        <Link href="/admin/settings" className="underline">
          Board
        </Link>
        <strong>AI</strong>
      </nav>
      <h1 className="text-2xl font-semibold">
        {welcome
          ? "One more step: let the board do the sorting"
          : "AI settings"}
      </h1>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{statusLabel(s)}</h2>
        {s.keptOffAt && (
          <p>
            Kept off by {s.keptOffBy ?? "an administrator"} on{" "}
            {new Date(s.keptOffAt).toLocaleDateString()}.
          </p>
        )}
        {s.state === "off" && (
          <p>
            Screen new feedback, give posts titles and categories, search by
            meaning, and group requests into themes. New OpenRouter accounts
            need prepaid credit.
          </p>
        )}
        {s.state === "on" && (
          <p>
            Using {s.options.model}. New content is screened. Insights and Ask
            AI are ready. Existing posts and comments can be indexed and keep
            their original titles and moderation history.
          </p>
        )}
        {s.state === "on" && s.options.embeddingModel !== "none" && (
          <IndexProgress />
        )}
        {s.state === "credit" && (
          <p>
            Connected. Add credit to finish turning on AI. You can close this
            page. Checks continue while the board has an ordinary request
            allowance, through{" "}
            {s.creditWaitUntil &&
              new Date(s.creditWaitUntil).toLocaleDateString()}
            .
          </p>
        )}
        {s.state === "expired" && (
          <p>Still no credit. Use Test again after adding credit.</p>
        )}
        {s.state === "paused" && (
          <p>
            {s.budget.used >= s.options.dailyCallLimit
              ? "New anonymous posts are paused"
              : "Only screening can use the remaining ordinary allowance"}{" "}
            until {new Date(s.budget.resetAt).toLocaleTimeString()}.
          </p>
        )}
        {s.state === "attention" && <p role="alert">{issueText(s.reason)}</p>}
        {s.keySource === "environment" ? (
          <p>
            Configured on the server by OPENROUTER_API_KEY
            {s.last4 ? " · ends in …" + s.last4 : ""}.
          </p>
        ) : (
          s.last4 && (
            <p>
              Stored key ending in …{s.last4}.{" "}
              {s.keyUrl && (
                <a
                  className="underline"
                  href={s.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Confirm it’s yours
                </a>
              )}
              . If OpenRouter cannot find it in your account, remove the key.
            </p>
          )
        )}
        {publicHttps && s.keySource !== "environment" && (
          <p>
            OpenRouter will show this board’s address as the app that created
            the key when you use a redirect.{" "}
            <button
              disabled={busy}
              className="underline"
              onClick={() => connect(true)}
            >
              Connect without listing
            </button>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <AiNextAction allowKeptOff />
          {s.canEnable &&
            (s.state === "on" ||
              s.state === "paused" ||
              s.state === "credit") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void change("test-again")}
              >
                Test again
              </Button>
            )}
          {s.keySource === "stored" && !s.unreadable && (
            <Button variant="outline" disabled={busy} onClick={() => connect()}>
              Reconnect OpenRouter
            </Button>
          )}
          {s.undo && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void change("undo")}
            >
              Undo
            </Button>
          )}
        </div>
        {flow && /^[0-9a-f]{32}$/.test(flow) && (
          <div>
            {alternate && (
              <a
                className="underline"
                href={alternate}
                target="_blank"
                rel="noreferrer"
              >
                Open OpenRouter authorization
              </a>
            )}
            <SecretField
              autoFocus
              label="Paste the code OpenRouter shows you"
              onSubmit={pasteCode}
            />
          </div>
        )}
        {s.keySource !== "environment" && (
          <details>
            <summary className="cursor-pointer">
              {s.last4
                ? "Paste a new key"
                : "Already have an OpenRouter key? Paste it"}
            </summary>
            <SecretField
              label="OpenRouter key"
              onSubmit={paste}
              unsecured={origin.protocol !== "https:"}
            />
          </details>
        )}
        {problem && <p role="alert">{problem}</p>}
        {s.check && (
          <p>
            Last check at {new Date(s.check.at).toLocaleString()}. Key{" "}
            {s.check.key}. Chat {s.check.chat}
            {s.check.chatIssue ? " — " + issueText(s.check.chatIssue) : ""}.
            Search {s.check.search}
            {s.check.searchIssue ? " — " + issueText(s.check.searchIssue) : ""}.
            {s.check.actualDimensions &&
              " Model returned " +
                s.check.actualDimensions +
                " dimensions, index uses " +
                s.dimensions +
                "."}
          </p>
        )}
        {details && (
          <p>
            {details.limit == null
              ? "No provider spend limit is reported."
              : "Provider spend limit $" +
                details.limit +
                "; remaining " +
                (details.remaining == null
                  ? "unknown"
                  : "$" + details.remaining) +
                "."}{" "}
            {details.expiresAt &&
              "Key expires " +
                new Date(details.expiresAt).toLocaleDateString() +
                "."}{" "}
            {s.keyUrl && (
              <a
                href={s.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Manage key spend limit
              </a>
            )}
          </p>
        )}
        {keyInfoFailed && active && !checkedDetails && (
          <p>Current provider spend details are unavailable.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {!s.keptOffAt && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void change("keep-off")}
            >
              {s.state === "on" || s.state === "paused"
                ? "Turn off AI"
                : "Keep AI off"}
            </Button>
          )}
          {s.keySource === "stored" && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void change("remove")}
            >
              Remove key
            </Button>
          )}
          {s.state === "credit" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api.dismissAiNoticeForMe.mutate({ notice: "off" });
                  router.push("/admin/activity");
                })
              }
            >
              Not now
            </Button>
          )}
          {welcome && (
            <Link className="underline" href="/admin">
              Skip for now
            </Link>
          )}
        </div>
      </section>
      <Advanced status={s} />
    </main>
  );
}

function IndexProgress() {
  const trpc = useTRPC(),
    query = useQuery(
      trpc.getSearchIndex.queryOptions(undefined, { refetchInterval: 5000 }),
    );
  if (!query.data) return null;
  const { total, pending, skipped } = query.data,
    done = total - pending - skipped;
  return (
    <div>
      <p>
        Search index: {done} of {total} posts and comments indexed.{" "}
        {skipped > 0 && skipped + " skipped."}
      </p>
      {total > 0 && (
        <progress
          aria-label="Search indexing progress"
          value={done}
          max={total}
        />
      )}
    </div>
  );
}
