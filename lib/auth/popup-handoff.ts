import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { splitSetCookieHeader } from "better-auth/cookies";

// Phase 3 implements only credential stripping. Social handoff is P05.
export function popupHandoff(): BetterAuthPlugin {
  return {
    id: "feedbackland-popup-handoff",
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.newSession ?? ctx.context.session;
            const embedded =
              (session?.session as { scope?: string } | undefined)?.scope ===
              "embedded";
            const headers = ctx.context.responseHeaders;
            if (!headers) return;
            if (!embedded) {
              headers.delete("set-auth-token");
              const exposed = headers
                .get("access-control-expose-headers")
                ?.split(",")
                .map((x) => x.trim())
                .filter((x) => x.toLowerCase() !== "set-auth-token" && x);
              if (exposed?.length)
                headers.set(
                  "access-control-expose-headers",
                  exposed.join(", "),
                );
              else headers.delete("access-control-expose-headers");
            }
            if (
              embedded ||
              ctx.headers?.get("x-feedbackland-scope") === "embedded" ||
              ctx.headers?.has("authorization")
            ) {
              const names = new Set(
                Object.values(ctx.context.authCookies).map(
                  (cookie) => cookie.name,
                ),
              );
              const cookies = splitSetCookieHeader(
                headers.get("set-cookie") ?? "",
              );
              headers.delete("set-cookie");
              for (const cookie of cookies) {
                if (!names.has(cookie.slice(0, cookie.indexOf("=")).trim()))
                  headers.append("set-cookie", cookie);
              }
            }
          }),
        },
      ],
    },
  };
}
