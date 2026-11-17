"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { useAiAdmin, statusLabel } from "@/components/app/ai-settings/status";
import { aiSettingsPath } from "@/lib/ai-onboarding-copy";
export function InstanceStatus() {
  const trpc = useTRPC(),
    { status } = useAiAdmin();
  const query = useQuery(
    trpc.getSystemStatus.queryOptions(undefined, {
      refetchInterval: (q) => (q.state.error ? 30000 : 5000),
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always",
      retry: false,
    }),
  );
  const sys = query.data;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Instance</h2>
      {query.isError ? (
        <p role="alert">Instance status unavailable.</p>
      ) : sys ? (
        <>
          <p>
            Version {sys.version}. Board address {sys.appUrl} ({sys.source}).
          </p>
          <p>
            Client IP header <code>{sys.clientIpHeader}</code>. This replica
            sampled {sys.requests} recent requests.
          </p>
          {sys.missingClientIp > 0 && (
            <p>
              Client IP header missing from {sys.missingClientIp} sampled
              requests.
            </p>
          )}
          {sys.mismatchedHost > 0 && (
            <p>
              The Host header differed from the board address on{" "}
              {sys.mismatchedHost} sampled requests. Check the proxy and sign-in
              address.
            </p>
          )}
          {sys.recoveryEnabled && <p>Recovery is enabled.</p>}
          {sys.source === "request headers" && (
            <p>
              The board infers its address. Set APP_URL for a fixed public
              address.
            </p>
          )}
        </>
      ) : (
        <p>Loading instance details…</p>
      )}
      <p>
        {status && statusLabel(status)} {status?.options.model} ·{" "}
        <Link className="underline" href={aiSettingsPath}>
          AI settings
        </Link>
      </p>
    </section>
  );
}
