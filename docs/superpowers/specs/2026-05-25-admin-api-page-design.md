# Admin "API" Page — Design

**Date:** 2026-05-25
**Status:** Approved
**Author:** Claude (with David)

## Goal

Add an `/admin/api` page that exposes the existing `POST /api/feedback/create`
endpoint in a polished, developer-friendly way: clear reference docs, copy-able
code snippets in multiple languages, and a live "Try it" playground that hits
the real endpoint with cleanup affordances.

## Non-goals

- API-key authentication, rate-limiting, usage metrics, request log viewer
- Multi-endpoint catalog (only the one anonymous feedback endpoint is documented)
- SDK generation, OpenAPI export, TypeScript-types download

## Existing surface (what we're exposing)

- **Route**: `POST https://<host>/api/feedback/create`
- **Auth**: none (CORS `*`, anonymous, server-side `authorId: null`)
- **Request body**: `{ orgId: UUID, description: string (1..10000) }`
- **Response 200**: full feedback-post object (id, title, category, description,
  authorId, orgId, embedding, createdAt, updatedAt, upvotes, status)
- **Source**: `app/api/feedback/create/route.ts`

## Page anatomy (single column, top-to-bottom)

1. **Header** — title (`<h2 className="h5 mb-6">API</h2>`) + one-line tagline.
2. **Endpoint card** — method badge (`POST`), full URL, copy button, "Public
   endpoint — no authentication required." note.
3. **Try it (Playground)** — read-only `orgId` field, multi-line `description`
   textarea with char counter (1..10000), Reset + Send buttons, response panel.
4. **Code examples** — tabbed cURL / JavaScript / Python snippets that
   regenerate live as the playground description changes.
5. **Reference** — request body table, response (200) summary, error codes
   (400 / 500) summary.

## File layout

| File | Role |
|---|---|
| `app/[orgSubdomain]/(board)/admin/api/page.tsx` | Client page. Fetches org via `useOrg`. Renders heading + `<ApiDocs orgId orgSubdomain />`. Loading skeleton while pending. |
| `components/app/api-docs/index.tsx` | Composition root. Holds shared `description` state and threads it down. No business logic. |
| `components/app/api-docs/endpoint-card.tsx` | Static-ish hero card. Pure presentation. |
| `components/app/api-docs/playground.tsx` | Live request form, response viewer, delete-test-post affordance. |
| `components/app/api-docs/code-examples.tsx` | Tabbed snippets. Consumes shared `description`. |
| `components/app/api-docs/reference.tsx` | Tables for body / response / errors. Pure markup. |
| `lib/api-snippets.ts` | Pure functions `buildCurl/buildJs/buildPython({ url, orgId, description })`. Single source of truth, easy to unit-test. |
| `components/app/admin-root/index.tsx` | Add one `<TabsTrigger value="api" asChild><Link href={`${adminBasePath}/api`}>API</Link></TabsTrigger>` entry. |

Each file is single-responsibility and small (target < 150 lines) so it can be
held in context and modified in isolation.

## State & data flow

- `description: string` lives in `<ApiDocs>` and is passed down to
  `<Playground>` (read + write) and `<CodeExamples>` (read only). Two
  consumers ⇒ shared parent is the right scope; no need for Jotai / Zustand.
- `endpointUrl` is derived from `window.location.origin`. To avoid hydration
  mismatches it's initialized to an empty string on the server and set in a
  client-only `useEffect` on first mount. Snippets and the endpoint card
  render a non-interactive placeholder ("…") while the URL is empty, replaced
  the moment it's known (a single re-render).
- `orgId` is passed from the page (already loaded by `useOrg`).
- The send-request flow lives entirely inside `<Playground>`:
  - Pre-flight validation against the same 1..10000 length the server enforces.
  - `fetch(endpointUrl, { method: 'POST', headers, body })` — deliberately
    using native fetch, not tRPC, so the playground demonstrates the exact
    path a third-party would take.
  - Records latency (`performance.now()` deltas), response status, parsed JSON.
  - On 2xx success with a returned `id`: store the id in state, show a
    `[Delete test post]` button that calls `trpc.deleteFeedbackPost.mutate`
    and on success invalidates `trpc.getFeedbackPosts` so the board view stays
    clean.
- Errors are first-class:
  - **Network error**: shown as a red Alert above the response panel.
  - **Non-2xx response**: still shown in the response panel (status badge
    colored by class) so admins can debug their own integration's payload.
  - **Validation error (client-side)**: inline message under the textarea.

## Snippet generation (`lib/api-snippets.ts`)

Three pure exports. Each takes `{ url: string, orgId: string, description: string }`
and returns a string. They JSON-escape `description` correctly so multi-line
or quote-containing input doesn't break the snippet:

- `buildCurl` — `\`-d '<json>'\`` form, with the JSON body produced via
  `JSON.stringify` to avoid hand-escaping bugs.
- `buildJs` — `fetch(url, { method, headers, body: JSON.stringify(...) })`.
  Works in modern browsers and Node 18+.
- `buildPython` — uses `requests.post(url, json=...)`, the canonical idiom.

If `description` is empty, snippets fall back to a stable placeholder
(`"Your feedback here"`) so users always see a runnable example.

## Visual conventions reused from the existing codebase

- Heading: `<h2 className="h5 mb-6">` (matches widget, settings, admins).
- Cards: `<Card>` + `<CardHeader>` + `<CardTitle>` + `<CardDescription>` +
  `<CardContent>`.
- Code blocks: existing `<Code lang="..." />` (Shiki, theme-aware, built-in
  copy button).
- Tabs: existing `<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>`.
- Buttons / inputs / textarea / labels / tooltip: shadcn primitives already in
  `components/ui/*`.
- Loading: `<Skeleton>` while `useOrg().query.isPending`.
- Error banner: existing `<Error>` component.

## Accessibility

- Every input has a programmatically associated `<Label>`.
- Response panel is `role="region" aria-live="polite"` so a screen reader
  announces the result after Send.
- Status-code badge has both a color and a text label (never color-only).
- All interactive controls are reachable via keyboard with visible focus rings
  (Tailwind defaults already in place project-wide).
- The "Delete test post" button announces its action via a clear name; on
  success collapses to non-interactive "Test post deleted." text.

## Responsiveness

- Single-column on mobile, capped width on desktop (matches the wider admin
  pages — no special max-width override needed, the layout from `AdminRoot`
  handles it).
- Code blocks scroll horizontally rather than overflowing the viewport.
- Tabs row remains visible (no wrap collapse) at the smallest supported width.

## Theme support

Inherited automatically from the existing `<Code>` component (Shiki + next-themes).
No additional theme wiring needed.

## Robustness checklist

- [x] Pure-function snippet generators (no hooks) ⇒ trivially testable, reusable.
- [x] Client-side validation matches server-side zod schema (1..10000 chars).
- [x] `endpointUrl` computed in `useEffect` ⇒ no hydration mismatch.
- [x] Native `fetch` for the playground ⇒ same path as third-party integrators
  (no "but it worked in my dashboard" disconnect).
- [x] `[Delete test post]` cleans up after successful test, with cache
  invalidation so the public board stays clean.
- [x] Non-2xx responses still surface to the user (don't silently drop errors).
- [x] No new dependencies.
- [x] Files small + single-purpose ⇒ easy to evolve (add a second endpoint
  later by composing another section without touching existing ones).

## Out of scope (explicit YAGNI)

- API-key auth, rotation UI, usage dashboard
- Per-org rate-limiting display
- Additional endpoints (comments / posts read / etc.) — structure permits
  adding them, but no shells/placeholders pre-built
- Localization beyond the English copy already in the rest of the app

## Open questions

None at design-approval time. Implementation can proceed.
