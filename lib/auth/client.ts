"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "./server";
import type { ResolvedSurface } from "../embed-surface";
const storageKey = "feedbackland-embedded-session";
let memoryToken: string | null = null;
let memoryOnly = false;
let credentialEpoch = 0;
export function getEmbeddedToken() {
  if (typeof window === "undefined") return null;
  if (memoryOnly) return memoryToken;
  try {
    memoryToken = window.localStorage.getItem(storageKey);
    return memoryToken;
  } catch {
    memoryOnly = true;
    return memoryToken;
  }
}
export function setEmbeddedToken(token: string | null) {
  if (typeof window === "undefined") return;
  credentialEpoch++;
  memoryToken = token;
  try {
    if (token) window.localStorage.setItem(storageKey, token);
    else window.localStorage.removeItem(storageKey);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
}
export function createSurfaceAuthClient(
  surface: ResolvedSurface,
  signal?: AbortSignal,
) {
  const embedded = surface === "drawer";
  return createAuthClient({
    // SSR does not fetch. Pin the inert SSR origin so SDK environment fallbacks
    // can never choose a deployment URL; the browser always uses its own origin.
    baseURL:
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin,
    basePath: "/api/auth",
    plugins: [inferAdditionalFields<Auth>()],
    fetchOptions: {
      credentials: embedded ? "omit" : "include",
      customFetchImpl: async (input, init) => {
        const epoch = credentialEpoch;
        const previous = embedded ? getEmbeddedToken() : null;
        // Select the bearer here, synchronously with this snapshot. The SDK's
        // async auth-header construction happens before customFetchImpl, so
        // using its token callback would fence a different credential.
        const headers = new Headers(init?.headers);
        headers.delete("authorization");
        headers.delete("x-feedbackland-scope");
        if (embedded) {
          headers.set("x-feedbackland-scope", "embedded");
          if (previous) headers.set("authorization", `Bearer ${previous}`);
        }
        const combined =
          signal && init?.signal
            ? AbortSignal.any([signal, init.signal])
            : (signal ?? init?.signal);
        const response = await fetch(input, {
          ...init,
          headers,
          credentials: embedded ? "omit" : "include",
          signal: combined,
        });
        // Late replies from a disposed surface or an earlier identity must not
        // restore a cleared/replaced bearer in shared storage.
        if (
          embedded &&
          !combined?.aborted &&
          epoch === credentialEpoch &&
          previous === getEmbeddedToken()
        ) {
          const token = response.headers.get("set-auth-token");
          if (token && token !== previous) setEmbeddedToken(token);
        }
        return response;
      },
    },
  });
}
