import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactNode } from "react";
import type { AppRouter } from "../../trpc";
import { TRPCProvider, useTRPC } from "../../providers/trpc-client";
import { useUpdateSettings } from "../../hooks/use-update-settings";
import { AuthProvider } from "../../hooks/use-auth";
import { SignUpInDialog } from "../../components/app/sign-up-in/dialog";
import { SignUpIn } from "../../components/app/sign-up-in";
import { ForgotPasswordForm } from "../../components/app/forgot-password/form";
import { UpvoteButton } from "../../components/app/upvote-button";
import { CommentUpvoteButton } from "../../components/app/comment/upvote-button";

function Probe({
  capture,
}: {
  capture: (value: {
    mutation: ReturnType<typeof useUpdateSettings>;
    trpc: ReturnType<typeof useTRPC>;
  }) => void;
}) {
  const mutation = useUpdateSettings(),
    trpc = useTRPC();
  capture({ mutation, trpc });
  return null;
}

async function main() {
  let state = {
    revision: "1",
    platformTitle: "Fixture",
    platformDescription: null,
    logoImageId: null,
    allowIndexing: true,
    setupCompletedAt: null,
  };
  let failNextRead = false;
  let holdNextRead = false;
  let holdNextSave = false;
  let releaseRead: (() => void) | undefined;
  let releaseSave: (() => void) | undefined;
  let reads = 0,
    saves = 0,
    refreshes = 0,
    outbound = 0;
  const originalFetch = globalThis.fetch;
  const originalChannel = globalThis.BroadcastChannel;
  globalThis.fetch = async () => {
    outbound++;
    throw new Error("External HTTP forbidden in client contracts");
  };
  const cache = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const client = createTRPCClient<AppRouter>({
    links: [
      () =>
        ({ op }) =>
          observable((observer) => {
            let data: unknown;
            if (op.path === "getSettings") {
              reads++;
              if (failNextRead) {
                failNextRead = false;
                observer.error(
                  TRPCClientError.from(new Error("Fixture read outage")),
                );
                return;
              }
              data = { ...state };
              if (holdNextRead) {
                holdNextRead = false;
                releaseRead = () => {
                  observer.next({ result: { data } });
                  observer.complete();
                };
                return;
              }
            } else if (op.path === "updateSettings") {
              assert.equal(
                (op.input as { expectedRevision: string }).expectedRevision,
                state.revision,
                "Save used a stale private revision",
              );
              saves++;
              state = {
                ...state,
                platformTitle: (
                  op.input as { platformTitle: string }
                ).platformTitle.trim(),
                revision: (BigInt(state.revision) + 1n).toString(),
              };
              data = { ...state };
              if (holdNextSave) {
                holdNextSave = false;
                releaseSave = () => {
                  observer.next({ result: { data } });
                  observer.complete();
                };
                return;
              }
            } else throw new Error(`Unexpected client operation ${op.path}`);
            observer.next({ result: { data } });
            observer.complete();
          }),
    ],
  });
  const router: AppRouterInstance = {
    back() {},
    forward() {},
    refresh() {
      refreshes++;
    },
    push() {},
    replace() {},
    prefetch() {},
    bfcacheId: "fixture",
  };
  const render = (children: ReactNode) =>
    renderToStaticMarkup(
      <QueryClientProvider client={cache}>
        <TRPCProvider trpcClient={client} queryClient={cache}>
          <AppRouterContext.Provider value={router}>
            <AuthProvider>{children}</AuthProvider>
          </AppRouterContext.Provider>
        </TRPCProvider>
      </QueryClientProvider>,
    );
  let unsubscribe: (() => void) | undefined;
  try {
    for (const method of ["sign-in", "sign-up"] as const)
      assert.equal(
        render(
          <SignUpInDialog
            open
            initialSelectedMethod={method}
            onClose={() => {}}
          />,
        ),
        "",
      );
    for (const method of ["sign-in", "sign-up", "forgot-password"] as const) {
      const html = render(
        <SignUpIn selectedMethod={method} onSuccess={() => {}} />,
      );
      assert.match(html, /Sign-in is available in a later milestone/);
      assert.doesNotMatch(
        html,
        /<form|<input|Google|Microsoft|Send reset link/,
      );
    }
    assert.doesNotMatch(
      render(<ForgotPasswordForm onGoBack={() => {}} />),
      /<form|<input|Send reset link/,
    );
    for (const element of [
      <UpvoteButton
        key="post"
        postId="fixture-post"
        upvoteCount="0"
        hasUserUpvote={false}
      />,
      <CommentUpvoteButton
        key="comment"
        commentId="fixture-comment"
        upvoteCount="0"
        hasUserUpvote={false}
      />,
    ]) {
      const html = render(element);
      assert.match(html, /<button[^>]*disabled=""/);
      assert.match(
        html,
        /aria-label="Voting requires sign-in, available in a later milestone"/,
      );
      assert.doesNotMatch(html, /<form|role="dialog"/);
    }
    let captured: Parameters<typeof Probe>[0] extends {
      capture: (value: infer T) => void;
    }
      ? T | undefined
      : never;
    render(
      <Probe
        capture={(value) => {
          captured = value;
        }}
      />,
    );
    assert(captured);
    const { mutation, trpc } = captured;
    const options = trpc.getSettings.queryOptions();
    await cache.fetchQuery(options);
    const observer = new QueryObserver(cache, options);
    unsubscribe = observer.subscribe(() => {});
    // Missing browser API must not turn a successful mutation into an error.
    Reflect.set(globalThis, "BroadcastChannel", undefined);
    for (const expected of ["2", "3"]) {
      const current = cache.getQueryData(options.queryKey);
      assert(current);
      await mutation.mutateAsync({
        expectedRevision: current.revision,
        platformTitle: "  Changed  ",
      });
      assert.equal(cache.getQueryData(options.queryKey)?.revision, expected);
      assert.equal(observer.getCurrentResult().data?.revision, expected);
    }
    assert.equal(saves, 2);
    assert.equal(reads, 3);
    assert.equal(refreshes, 2);
    failNextRead = true;
    // A committed write stays successful and retains canonical values even when
    // its subsequent refetch fails. Optional browser notifications can fail too.
    Reflect.set(
      globalThis,
      "BroadcastChannel",
      class {
        constructor() {
          throw new Error("Fixture browser API disabled");
        }
      },
    );
    await mutation.mutateAsync({
      expectedRevision: "3",
      platformTitle: "  Canonical  ",
    });
    assert.equal(observer.getCurrentResult().status, "error");
    assert.equal(cache.getQueryData(options.queryKey)?.revision, "4");
    assert.equal(
      cache.getQueryData(options.queryKey)?.platformTitle,
      "Canonical",
    );
    await mutation.mutateAsync({
      expectedRevision: "4",
      platformTitle: "Recovered",
    });
    assert.equal(cache.getQueryData(options.queryKey)?.revision, "5");

    // Cancel a read taken before commit. Its late response cannot roll back the
    // cache, including when the replacement read also fails.
    holdNextRead = true;
    const oldRead = cache.refetchQueries({ queryKey: options.queryKey });
    assert(releaseRead);
    failNextRead = true;
    await mutation.mutateAsync({
      expectedRevision: "5",
      platformTitle: "Newer",
    });
    releaseRead();
    await oldRead;
    assert.equal(cache.getQueryData(options.queryKey)?.revision, "6");

    // Out-of-order mutation responses must not replace a newer snapshot. Use
    // revisions beyond Number.MAX_SAFE_INTEGER to exercise exact comparison.
    state = { ...state, revision: "9007199254740993" };
    cache.setQueryData(options.queryKey, { ...state });
    holdNextSave = true;
    const delayed = mutation.mutateAsync({
      expectedRevision: state.revision,
      platformTitle: "Delayed",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert(releaseSave);
    state = { ...state, revision: "9007199254740995", platformTitle: "Newest" };
    cache.setQueryData(options.queryKey, { ...state });
    failNextRead = true;
    releaseSave();
    await delayed;
    assert.deepEqual(cache.getQueryData(options.queryKey), state);
    assert.equal(outbound, 0);
    console.log(
      "client contracts: auth surfaces closed; settings snapshots survive refetch failures, stale reads and out-of-order responses",
    );
  } finally {
    unsubscribe?.();
    cache.clear();
    globalThis.fetch = originalFetch;
    globalThis.BroadcastChannel = originalChannel;
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
