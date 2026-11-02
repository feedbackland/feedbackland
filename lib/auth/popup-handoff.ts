import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  addOAuthServerContext,
  createAuthEndpoint,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api";
import { deleteSessionCookie, splitSetCookieHeader } from "better-auth/cookies";
import { makeSignature } from "better-auth/crypto";
import { z } from "zod";

export type HandoffValue = {
  h: string;
  mode: "embedded" | "first-party";
  state: "pending" | "done" | "error";
  token?: string;
  error?: string;
};
export type HandoffDependencies = {
  allowed(headers: Headers): Promise<boolean>;
  reserve(ticket: string, value: HandoffValue): Promise<boolean>;
  read(ticket: string): Promise<HandoffValue | null>;
  bind(
    ticket: string,
    previous: HandoffValue,
    next: HandoffValue,
  ): Promise<boolean>;
  claim(
    ticket: string,
    secret: string,
  ): Promise<
    | { kind: "missing" | "forbidden" | "pending" }
    | { kind: "bound"; value: HandoffValue }
  >;
};
const ticketSchema = z.string().regex(/^[a-f0-9]{32}$/);
const ticketCookie = "fl_popup_ticket";
const oldCookie = Symbol("popup-prior-session");
type PriorContext = { [oldCookie]?: string };
const errorCodes = new Set([
  "account_not_linked",
  "access_denied",
  "state_mismatch",
  "invalid_callback_request",
  "state_not_found",
  "state_expired",
  "unable_to_get_user_info",
  "unable_to_link_account",
]);
function safeError(error: string | null) {
  return error && errorCodes.has(error) ? error : "sign_in_failed";
}

// Pure plugin: persistence and rate admission are injected, including DDL stubs.
export function popupHandoff(deps?: HandoffDependencies): BetterAuthPlugin {
  return {
    id: "feedbackland-popup-handoff",
    endpoints: deps
      ? {
          startPopupHandoff: createAuthEndpoint(
            "/popup-handoff/start",
            {
              method: "POST",
              body: z
                .object({
                  ticket: ticketSchema,
                  h: z.string().regex(/^[a-f0-9]{64}$/),
                  mode: z.enum(["embedded", "first-party"]),
                })
                .strict(),
            },
            async (ctx) => {
              if (!(await deps.allowed(ctx.headers ?? new Headers())))
                throw new APIError("TOO_MANY_REQUESTS", {
                  message: "Try again shortly",
                });
              const site = ctx.headers?.get("sec-fetch-site");
              if (site && site !== "same-origin")
                throw new APIError("FORBIDDEN");
              const { ticket, h, mode } = ctx.body;
              const reserved = await deps.reserve(ticket, {
                h,
                mode,
                state: "pending",
              });
              if (!reserved) {
                const cookie = await ctx.getSignedCookie(
                  ticketCookie,
                  ctx.context.secret,
                );
                const existing = await deps.read(ticket);
                if (
                  cookie !== ticket ||
                  existing?.h !== h ||
                  existing.mode !== mode ||
                  existing.state !== "pending"
                )
                  throw new APIError("CONFLICT", {
                    message: "Start a new sign-in",
                  });
              }
              await ctx.setSignedCookie(
                ticketCookie,
                ticket,
                ctx.context.secret,
                {
                  httpOnly: true,
                  sameSite: "lax",
                  secure:
                    ctx.context.options.advanced?.useSecureCookies ?? false,
                  path: "/",
                  maxAge: 600,
                },
              );
              return ctx.json({ started: true });
            },
          ),
          claimPopupHandoff: createAuthEndpoint(
            "/popup-handoff/claim",
            {
              method: "POST",
              body: z
                .object({
                  ticket: ticketSchema,
                  secret: z.string().regex(/^[a-f0-9]{32}$/),
                })
                .strict(),
            },
            async (ctx) => {
              if (!(await deps.allowed(ctx.headers ?? new Headers())))
                throw new APIError("TOO_MANY_REQUESTS", {
                  message: "Try again shortly",
                });
              const result = await deps.claim(ctx.body.ticket, ctx.body.secret);
              if (result.kind === "missing") throw new APIError("NOT_FOUND");
              if (result.kind === "forbidden") throw new APIError("FORBIDDEN");
              if (result.kind === "pending") {
                ctx.setStatus(202);
                return ctx.json({ pending: true });
              }
              if (result.kind !== "bound") throw new APIError("BAD_REQUEST");
              if (result.value.state === "error")
                return ctx.json({
                  error: safeError(result.value.error ?? null),
                });
              if (result.value.mode === "first-party")
                return ctx.json({ done: true });
              const token = result.value.token;
              if (!token) throw new APIError("BAD_REQUEST");
              return ctx.json({
                token: `${token}.${await makeSignature(token, ctx.context.secret)}`,
              });
            },
          ),
        }
      : undefined,
    hooks: {
      before: deps
        ? [
            {
              matcher: (ctx) => ctx.path === "/sign-in/social",
              handler: createAuthMiddleware(async (ctx) => {
                const ticket = await ctx.getSignedCookie(
                  ticketCookie,
                  ctx.context.secret,
                );
                if (
                  !ticket ||
                  !ticketSchema.safeParse(ticket).success ||
                  ctx.body?.idToken
                )
                  throw new APIError("BAD_REQUEST", {
                    message: "Open the sign-in confirmation first",
                  });
                const value = await deps.read(ticket);
                if (!value || value.state !== "pending")
                  throw new APIError("BAD_REQUEST", {
                    message: "Start a new sign-in",
                  });
                await addOAuthServerContext({
                  popupTicket: ticket,
                  popupHash: value.h,
                  popupMode: value.mode,
                });
                const done = `/auth/popup/done?ticket=${ticket}`;
                if (
                  ctx.body.callbackURL !== done ||
                  ctx.body.errorCallbackURL !== done
                )
                  throw new APIError("BAD_REQUEST", {
                    message:
                      "Another sign-in popup replaced this request. Close it and try again.",
                  });
                ctx.body.callbackURL = done;
                ctx.body.errorCallbackURL = done;
                ctx.body.newUserCallbackURL = done;
              }),
            },
            {
              matcher: (ctx) => !!ctx.path?.startsWith("/callback/"),
              handler: createAuthMiddleware(async (ctx) => {
                const previous = await ctx.getSignedCookie(
                  ctx.context.authCookies.sessionToken.name,
                  ctx.context.secret,
                );
                if (previous) {
                  const prior =
                    await ctx.context.internalAdapter.findSession(previous);
                  if (
                    prior &&
                    (prior.session as { scope?: string }).scope ===
                      "first-party" &&
                    prior.session.expiresAt > new Date()
                  )
                    (ctx.context as PriorContext)[oldCookie] = previous;
                }
              }),
            },
          ]
        : undefined,
      after: [
        ...(deps
          ? [
              {
                matcher: (ctx: { path?: string }) =>
                  !!ctx.path?.startsWith("/callback/"),
                handler: createAuthMiddleware(async (ctx) => {
                  const state = await getOAuthState();
                  const trusted = state?.serverContext;
                  const trustedTicket =
                    typeof trusted?.popupTicket === "string" &&
                    ticketSchema.safeParse(trusted.popupTicket).success
                      ? trusted.popupTicket
                      : null;
                  const fallback = await ctx.getSignedCookie(
                    ticketCookie,
                    ctx.context.secret,
                  );
                  const ticket =
                    trustedTicket ??
                    (fallback && ticketSchema.safeParse(fallback).success
                      ? fallback
                      : null);
                  const created = ctx.context.newSession;
                  let isolate = trusted?.popupMode === "embedded" && !!created;
                  let embeddedToken: string | undefined;
                  let bound = false;
                  try {
                    if (!ticket) return;
                    const value = await deps.read(ticket);
                    if (value?.mode === "embedded" && created) isolate = true;
                    if (!value || value.state !== "pending") return;
                    const location =
                      ctx.context.responseHeaders?.get("location");
                    const callbackError = location
                      ? new URL(location, ctx.context.baseURL).searchParams.get(
                          "error",
                        )
                      : null;
                    if (
                      !trustedTicket ||
                      trusted?.popupHash !== value.h ||
                      trusted?.popupMode !== value.mode ||
                      callbackError
                    ) {
                      if (callbackError)
                        await deps.bind(ticket, value, {
                          ...value,
                          state: "error",
                          error: safeError(callbackError),
                        });
                      return;
                    }
                    if (!created) return;
                    if (value.mode === "first-party") {
                      await deps.bind(ticket, value, {
                        ...value,
                        state: "done",
                      });
                      return;
                    }
                    const session =
                      await ctx.context.internalAdapter.createSession(
                        created.user.id,
                        false,
                        { scope: "embedded" },
                        true,
                      );
                    if (!session) throw new APIError("INTERNAL_SERVER_ERROR");
                    embeddedToken = session.token;
                    bound = await deps.bind(ticket, value, {
                      ...value,
                      state: "done",
                      token: embeddedToken,
                    });
                  } finally {
                    if (isolate && created) {
                      // Also runs for expired/consumed tickets and failed persistence.
                      // Strip the new first-party credential before fallible cleanup.
                      deleteSessionCookie(ctx);
                      const previous = (ctx.context as PriorContext)[oldCookie];
                      try {
                        try {
                          if (embeddedToken && !bound)
                            await ctx.context.internalAdapter.deleteSession(
                              embeddedToken,
                            );
                        } finally {
                          if (created.session.token !== previous)
                            await ctx.context.internalAdapter.deleteSession(
                              created.session.token,
                            );
                        }
                      } finally {
                        // Cookie cache is disabled. Reissuing this exact earlier token
                        // never revives its DB session if it was revoked meanwhile.
                        if (previous)
                          await ctx.setSignedCookie(
                            ctx.context.authCookies.sessionToken.name,
                            previous,
                            ctx.context.secret,
                            ctx.context.authCookies.sessionToken.attributes,
                          );
                      }
                    }
                  }
                }),
              },
            ]
          : []),
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
