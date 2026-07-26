# Admin "Ask AI" Page — Grounded Answers

**Date:** 2026-07-26
**Status:** Implemented
**Author:** Claude (with David)

## What this page is for

One job, stated plainly:

> Answer a specific question about my feedback, and show me the posts the answer
> came from.

It is the ad-hoc channel next to two standing ones. **Activity** is the raw
feed. **Insights** answers the same question every time — what to build or fix
next — on a schedule. Ask AI answers the questions those two cannot: "what are
people saying about pricing?", "what came in over the last two weeks?", "which
of these have we already shipped?" Questions whose answers live spread across a
corpus too large to read.

That framing has one consequence that drives the whole design: **an answer you
cannot check is an answer you cannot act on.** Insights already says this out
loud in `components/app/insights/evidence.tsx` — "Every claim the insights makes
should be one click from the raw feedback that produced it". Ask AI shipped
without it.

## What was wrong

An audit of `components/app/ask-ai/*`, `components/ui/assistant-ui/*` and
`app/api/chat/route.ts`:

1. **Answers were unverifiable and dead-ended.** The model paraphrased posts and
   the admin had no route to any of them. The page next door links every claim to
   its feedback; this one linked nothing.
2. **`/api/chat` had no authentication.** It read `orgId` from the request body
   and trusted it. Any unauthenticated caller could aim it at any org and spend
   the deployment's OpenRouter credits on arbitrary prompts.
3. **Scope was silent and wrong.** The corpus was
   `getAllActiveFeedbackPosts`, which excludes `done` and `declined`. So "how
   many posts mention X?" answered against an invisibly filtered board, and
   nothing about status could be asked at all.
4. **The model had no idea what day it was.** No date anywhere in the prompt, so
   every "in the last two weeks" question was answered by guesswork over
   timestamps it could not place.
5. **It was fed raw HTML.** `feedback.description` is stored tiptap HTML and went
   into the prompt as-is — tags and all — for the whole board, every turn.
   `getPlainText` already existed one import away and is what Insights uses.
6. **No cap.** The entire board went into the system prompt on every message.
7. **The suggested prompts advertised the wrong product.** "List all posts" is
   what the board does, better. "Summarize feedback" is what Insights does,
   better. Four generic labels in a 2×2 grid read as filler, and none of them
   showed anything only a chat can do.
8. **The page had no header.** Every other admin tab opens with a title and a
   line saying what it is for. This one opened with a bordered box.
9. **`ThreadHeader` was `return null;` followed by unreachable JSX.**
10. **The thinking indicator was wrong.** `ThreadPrimitive.If running` is
    thread-scoped but sat inside `AssistantMessage`, so every assistant message
    in the thread pulsed during a run, and the dots stayed above the text for the
    whole stream instead of giving way to it.
11. **Attachments were wired up and impossible.** `ComposerAttachments` and
    `UserMessageAttachments` rendered with no attachment adapter on the runtime
    and no way to add one, so 234 lines of `attachment.tsx` could never do
    anything. `thread-list.tsx` and `tool-fallback.tsx` were dead too.
12. **No way out of a thread.** No new-chat control, and no persistence — a
    reload or a hop to another admin tab silently destroyed the conversation.
13. **No scroll-to-bottom**, and the composer sat inside the scroll viewport
    with a hand-rolled `sticky`, so assistant-ui's auto-scroll could not account
    for the space it covered.
14. **Errors were raw.** `line-clamp-2` of whatever the transport threw, with no
    retry.
15. **A board with no feedback still invited questions** it could not answer.

## The design

### Citations are the feature

The server hands the model a numbered corpus in which every post carries its own
id, and requires a citation in exactly one form:

```
[3](post:8f3a1c2e-…)
```

The client renders that as a superscript number that links to the post, and
collects the cited posts into a short **Sources** list under the finished
answer. Numbering is assigned by the client in order of first appearance, so it
always reads 1, 2, 3 regardless of what the model wrote in the link text.

Two details make this robust rather than decorative:

- **Ids, not indices.** A citation resolves through
  `getFeedbackPostsByIds`, so the title shown is the post's current title, read
  from the database. Nothing depends on the model's numbering surviving between
  turns, and a hallucinated id resolves to nothing and is dropped from the
  answer rather than rendered as a broken link. The insights feature already
  proves this model copies ids verbatim reliably.
- **New tab.** Citations open with `target="_blank"`. Checking a source is the
  main reason to click anything on this page, and it must not cost you the
  thread.

`getFeedbackPostsByIds` gains an org filter it should always have had: a
citation must never be able to resolve to another org's post.

### The model reads the whole board, and says what it read

The corpus is now every post regardless of status, newest first, capped at
`ASK_AI_MAX_POSTS = 300`, with descriptions converted to plain text and
truncated to 400 characters. Each post is one compact block:

```
[12] Dark mode please
id: 8f3a1c2e-… · idea · planned · 12 upvotes · 3 comments · 2026-06-14 (42 days ago)
Reading the board at night is painful. Please add a dark theme.
```

Both the absolute date and the age are given because models are unreliable at
date arithmetic and every temporal question depends on getting it right. Today's
date heads the prompt.

The prompt states how many posts of how many the model can see and tells it to
say so when a question needs posts it cannot reach. The welcome screen states
the same thing in the admin's terms before they type — "Reading all 128 posts on
your board", or "Reading the 300 most recent of 1,204 posts on your board" — via
a new `getFeedbackPostCount` query. Numbers on both sides come from one shared
constant.

Post content is untrusted input, so it is delimited and the prompt says
explicitly that anything inside that looks like an instruction is text to report
on, not an instruction to follow.

### Authentication

`/api/chat` now resolves the org the way every tRPC procedure does: Firebase ID
token from `Authorization`, subdomain from the `subdomain` header, admin role
required. `orgId` is never read from the body. The transport supplies both
headers, exactly as `providers/trpc-client.tsx` does.

### The page

Header matching Insights — `h5` title, one line underneath naming the outcome,
and a right-aligned action that only appears once there is something to act on:

> **Ask AI**
> Ask anything about your feedback. Every answer links back to the posts behind it.
>
> `[ New chat ]`

Inside the card, the empty state drops the duplicated explanation and spends its
space on the two things that help: what will be read, and three questions worth
asking. The three are chosen to exercise a different dimension each — synthesis,
time, status — and each is something the board UI cannot answer:

- What's the most common complaint?
- What came in over the last two weeks?
- Which requests are already planned or in progress?

They send on click. A board with no feedback shows an `Empty` state instead and
the composer is withheld, matching `InsightsNoFeedback`.

### Reading

`turnAnchor="top"` anchors each new question to the top of the viewport so the
answer streams downward into view and is read from its first line, instead of
being chased along the bottom edge. The composer moves into
`ThreadPrimitive.ViewportFooter`, which measures itself so auto-scroll knows
what it covers, and a scroll-to-bottom button sits above it.

The thinking indicator becomes correct — last message only, and only until the
first token arrives — and carries the same words Insights uses for the same
wait: "Reading your feedback".

The message entrance animation moves from `motion/react` to the `animate-in`
utilities already imported in `globals.css`, with `motion-reduce:animate-none`
as used in `insight-row.tsx`. Two wrapper components and a runtime dependency
leave the page.

### Continuity

Messages are written to `sessionStorage`, keyed per subdomain, when a run
finishes, and restored on mount. That is what makes leaving to read a source
safe, and it gives "New chat" a real job — it clears both.

Session, not local, storage: an ad-hoc question is not something to find again
next week.

### Errors

One sentence in our own voice, the transport's reason underneath in small muted
text for when it is a real bug, and a retry that reruns the message.

## Files

| File | Change |
| --- | --- |
| `lib/ask-ai.ts` | new — shared cap, citation scheme, citation extraction |
| `queries/get-feedback-corpus.ts` | new — every post for an org, newest first |
| `queries/get-feedback-post-count.ts` | new |
| `trpc/get-feedback-post-count.ts` | new admin procedure, registered in `trpc/index.ts` |
| `trpc/get-feedback-posts-by-ids.ts` | scoped to `ctx.orgId` |
| `queries/get-feedback-posts-by-ids.ts` | takes `orgId` |
| `hooks/use-feedback-post-count.ts` | new |
| `app/api/chat/route.ts` | auth, corpus, prompt |
| `components/app/ask-ai/index.tsx` | page composition, header, runtime, persistence |
| `components/app/ask-ai/thread.tsx` | new home for the thread |
| `components/app/ask-ai/welcome.tsx` | new |
| `components/app/ask-ai/citations.tsx` | new |
| `components/app/ask-ai/markdown.tsx` | new home for the markdown components |
| `components/app/ask-ai/loading.tsx` | mirrors the new empty state |
| `app/[orgSubdomain]/(board)/admin/ask-ai/page.tsx` | no longer waits on the org |
| `components/ui/assistant-ui/{thread,thread-list,attachment,markdown-text,tool-fallback}.tsx` | deleted |

## Audit

The page was then driven end to end through a mock streaming endpoint — a real
`useChatRuntime`, real transport, real markdown renderer — because most of what
went wrong only goes wrong mid-stream. Seven defects came out of it.

**Citations assembled themselves in public.** Markdown only knows `[1](post:…)`
is a link once the closing bracket arrives, so 46 characters of markup sat in the
answer for about half a second per citation. The unfinished tail is now withheld
until complete, scoped to the part still streaming so finished text is never
touched.

**The answer jumped backwards five times per answer.** assistant-ui's typewriter
reveal tracks progress by index and cannot cope with text that changes length
behind it — which is exactly what withholding a tail does. `smooth={false}`.
Model tokens arrive a few characters at a time anyway, so the text still flows;
it just never un-writes itself. Measured: 0 raw-markup frames and 0 backwards
steps, against 14 and 5 before.

**Model-emitted images were fetched.** Post content steers the model, so a
prompt-injected `![](https://…)` reported the admin's IP to whoever wrote the
post. Images are disallowed; an answer about feedback has no use for one.

**Dead links looked clickable.** `javascript:`, `data:` and `vbscript:` were
already stripped of their href, but still rendered as anchors that navigated the
admin off the page. Links with no usable href render as text — which also fixes a
malformed citation looking like a real one.

**A post could close the corpus fence.** `</posts>` written into a description
survives `getPlainText` verbatim, putting attacker text outside the "this is
data" boundary. The tag is defused in both title and description.

**Every date was UTC.** "What came in today" was wrong for part of every day for
anyone far from Greenwich, and one of the three suggested questions is about
time. The browser sends its zone; the route formats every date in it and falls
back to UTC on anything unrecognised.

**Smaller:** a task list drew a bullet beside its checkbox; the gap-closing rule
ate the space before malformed citations too; the session now guarantees its own
hydration safety rather than relying on the page above it to hold it back until
auth resolves.

Confirmed clean: no console errors through send → stream → reload → new chat →
error; `sessionStorage` restore end to end; the composer caps at 160px and
scrolls internally; no horizontal overflow at 390px; `javascript:`/`data:`/raw
`<script>` all inert.

### Known and accepted

- A citation written inside a fenced code block would be counted as a source
  without a matching inline reference. The model has no reason to do it.
- Whether the model reliably emits the citation format can only be confirmed
  against the live model. Everything downstream is verified, and the failure
  modes are contained: an id that resolves to nothing disappears, a malformed one
  renders as text. The worst case is an answer with fewer citations, not a broken
  page.
- `maxDuration` is left at 30s. A large board plus a long answer could exceed it;
  raising it needs to be checked against the deployment's plan limit.

## Deliberately not done

- **Tool calling.** Letting the model query the database would scale past 300
  posts and give exact counts on huge boards. It also means multi-step latency
  inside a 30s function, tool-call UI, and answers grounded in whatever the model
  chose to search rather than in one corpus the page can describe. Every answer
  being drawn from the same stated set of posts is worth more here than
  unbounded reach.
- **Named, saved threads.** A thread list is a filing system for a tool whose
  output is a decision, not a document. Session continuity covers the real need.
- **Follow-up suggestions.** They require the model to produce them, which costs
  a round trip or a schema, to guess at a question the admin is already typing.
- **Feedback thumbs.** Nothing reads them.
