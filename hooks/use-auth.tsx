"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSurfaceAuthClient, setEmbeddedToken } from "@/lib/auth/client";
import { canAdministerSession } from "@/lib/auth/session-policy";
import type { ResolvedSurface } from "@/lib/embed-surface";
import {
  openSocialPopup,
  type PopupFlow,
  type SocialProvider,
} from "@/lib/auth/popup-client";
type Client = ReturnType<typeof createSurfaceAuthClient>;
export type Session = Client["$Infer"]["Session"] | null;
type AuthContextValue = {
  session: Session;
  isLoaded: boolean;
  isAdmin: boolean;
  signInWithEmail(input: { email: string; password: string }): Promise<Session>;
  signUpWithEmail(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<Session>;
  signOut(): Promise<null>;
  requestPasswordReset(email: string): Promise<void>;
  signInWithSocial(
    provider: SocialProvider,
    flow: PopupFlow,
    signal: AbortSignal,
    onOpen?: (href: string) => void,
  ): Promise<Session>;
  refreshSession(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  surface = "first-party",
}: {
  children: ReactNode;
  surface?: ResolvedSurface;
}) {
  const [abort] = useState(() => new AbortController());
  const [client] = useState(() =>
    createSurfaceAuthClient(surface, abort.signal),
  );
  const disposing = useRef(false);
  useEffect(() => {
    disposing.current = false;
    return () => {
      disposing.current = true;
      queueMicrotask(() => {
        if (disposing.current) abort.abort();
      });
    };
  }, [abort]);
  const [revokedSessionId, setRevokedSessionId] = useState<string | null>(null);
  const query = client.useSession();
  const cache = useQueryClient();
  const session =
    query.data?.session.id === revokedSessionId ? null : query.data;
  const sessionId = session?.session.id ?? null;
  const resetIdentityQueries = async () => {
    await cache.cancelQueries();
    cache.removeQueries({ type: "inactive" });
    // Keep mounted observers attached so later invalidations still refetch.
    await cache.resetQueries({ type: "active" });
  };
  const previousSessionId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (query.isPending) return;
    const previous = previousSessionId.current;
    previousSessionId.current = sessionId;
    if (previous !== undefined && previous !== sessionId) {
      void cache.cancelQueries().then(async () => {
        cache.removeQueries({ type: "inactive" });
        await cache.resetQueries({ type: "active" });
      });
    }
  }, [cache, sessionId, query.isPending]);
  const afterSignIn = async () => {
    const result = await client.getSession();
    if (result.error || !result.data)
      throw new Error("The session could not be loaded. Please sign in again.");
    setRevokedSessionId(null);
    await query.refetch();
    await resetIdentityQueries();
    return result.data;
  };
  const value: AuthContextValue = {
    session,
    isLoaded: !query.isPending || (revokedSessionId !== null && !session),
    isAdmin: surface === "first-party" && canAdministerSession(session),
    async requestPasswordReset(email) {
      const result = await client.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error)
        throw new Error(
          "The reset request could not be submitted. Try again later.",
        );
    },
    async signInWithSocial(provider, flow, signal, onOpen) {
      await openSocialPopup(
        provider,
        flow,
        surface,
        AbortSignal.any([abort.signal, signal]),
        onOpen,
      );
      return afterSignIn();
    },
    async signInWithEmail(input) {
      const result = await client.signIn.email({
        email: input.email.trim(),
        password: input.password.trim(),
      });
      if (result.error)
        throw new Error(result.error.message ?? "Sign-in failed");
      return afterSignIn();
    },
    async signUpWithEmail(input) {
      const result = await client.signUp.email({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password.trim(),
      });
      if (result.error)
        throw new Error(result.error.message ?? "Sign-up failed");
      return afterSignIn();
    },
    async signOut() {
      const result = await client.signOut();
      if (result.error)
        throw new Error(result.error.message ?? "Sign-out failed");
      if (surface === "drawer") setEmbeddedToken(null);
      setRevokedSessionId(session?.session.id ?? null);
      await resetIdentityQueries();
      return null;
    },
    refreshSession: () => query.refetch(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value)
    throw new Error("Authentication requires a resolved surface provider");
  return value;
}
