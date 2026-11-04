"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";
export function AuthStatus() {
  const trpc = useTRPC(),
    cache = useQueryClient();
  const status = useQuery(
    trpc.getAuthStatus.queryOptions(undefined, { refetchInterval: 5000 }),
  );
  const retry = useMutation(
    trpc.retryOidcDiscovery.mutationOptions({
      onSuccess: (data) =>
        cache.setQueryData(trpc.getAuthStatus.queryKey(), data),
    }),
  );
  if (status.isPending) return <p role="status">Loading sign-in status…</p>;
  if (!status.data) return <p role="alert">Sign-in status is unavailable.</p>;
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold">Sign-in and recovery</h2>
      <p>
        Email password reset:{" "}
        {status.data.smtp ? "configured" : "not configured"}.
      </p>
      {status.data.recoveryEnabled && (
        <p role="alert">
          Operator recovery is enabled. Remove RECOVERY_CODE from all replicas
          after use.
        </p>
      )}
      <ul className="space-y-5">
        {status.data.providers.map((provider) => (
          <li className="space-y-2" key={provider.id}>
            <h3 className="font-semibold">{provider.name}</h3>
            <p>
              {provider.enabled ? "Enabled" : "Unavailable"}
              {provider.reason ? ` — ${provider.reason}` : ""}
            </p>
            {provider.callbackUrl && (
              <div>
                <code className="text-sm break-all">
                  {provider.callbackUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText(provider.callbackUrl!)}
                >
                  Copy callback URI
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        loading={retry.isPending}
        onClick={() => retry.mutate()}
      >
        Retry OIDC discovery
      </Button>
      {retry.error && (
        <p role="alert">Discovery retry could not complete. Try again later.</p>
      )}
    </section>
  );
}
