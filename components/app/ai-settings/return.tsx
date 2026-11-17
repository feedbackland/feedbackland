"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTRPCClient } from "@/providers/trpc-client";
import { useAiAdmin } from "./status";
import { aiSettingsPath } from "@/lib/ai-onboarding-copy";
export function ConnectReturn({ nonce }: { nonce: string }) {
  const once = useRef(false),
    api = useTRPCClient(),
    router = useRouter(),
    { refresh } = useAiAdmin(),
    [error, setError] = useState("");
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const params = new URLSearchParams(location.search),
      codes = params.getAll("code"),
      states = params.getAll("state");
    history.replaceState(history.state, "", location.pathname);
    const finish = async () => {
      const expired =
        "That connection timed out. Start Connect OpenRouter again.";
      if (
        codes.length !== 1 ||
        states.length !== 1 ||
        states[0] !== nonce ||
        !/^[a-f0-9]{32}$/.test(nonce)
      )
        throw new Error(expired);
      const result = await api.finishOpenRouter.mutate({
        mode: "redirect",
        nonce,
        code: codes[0],
        state: states[0],
      });
      if (result.repeated) throw new Error(expired);
      await refresh();
      router.replace(aiSettingsPath);
    };
    void finish().catch((e: Error) => setError(e.message));
  }, [api, nonce, refresh, router]);
  return (
    <main>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Link className="underline" href={aiSettingsPath}>
            Back to AI settings
          </Link>
        </>
      ) : (
        <p role="status">Finishing your OpenRouter connection…</p>
      )}
    </main>
  );
}
