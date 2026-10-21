# P02 query and procedure caller inventory

Generated from TypeScript import and re-export declarations using tsconfig module resolution by `scripts/caller-inventory.ts`. This records static importers, including the router index; it does not claim dynamic execution or authorization coverage. HTTP authorization and database invariants are exercised by phase-1 verification.

| Module | Importers |
|---|---|
| `queries/check-rate-limit.ts` | `lib/rate-limit.ts` |
| `queries/create-admin-invite.ts` | `trpc/create-admin-invite.ts` |
| `queries/create-comment.ts` | `trpc/create-comment.ts` |
| `queries/create-feedback-post.ts` | `app/api/feedback/create/route.ts`, `trpc/create-feedback-post.ts` |
| `queries/delete-admin-invite.ts` | `trpc/delete-admin-invite.ts` |
| `queries/delete-admin.ts` | `trpc/delete-admin.ts` |
| `queries/delete-comment.ts` | `trpc/delete-comment.ts` |
| `queries/delete-feedback-post.ts` | `trpc/delete-feedback-post.ts` |
| `queries/get-activity-feed-meta-data.ts` | `trpc/get-activity-feed-meta-data.ts` |
| `queries/get-activity-feed.ts` | `trpc/get-activity-feed.ts` |
| `queries/get-admin-invite.ts` | `trpc/get-admin-invite.ts` |
| `queries/get-admins.ts` | `trpc/get-admins.ts` |
| `queries/get-comment.ts` | `trpc/get-comment.ts` |
| `queries/get-comments.ts` | `trpc/get-comments.ts` |
| `queries/get-feedback-corpus.ts` | No active importer; retained typed/internal interface for a later milestone |
| `queries/get-feedback-post-count.ts` | `trpc/get-feedback-post-count.ts` |
| `queries/get-feedback-post.ts` | `trpc/get-feedback-post.ts` |
| `queries/get-feedback-posts-by-ids.ts` | `trpc/get-feedback-posts-by-ids.ts` |
| `queries/get-feedback-posts.ts` | `trpc/get-feedback-posts.ts` |
| `queries/get-insights-inputs.ts` | No active importer; retained typed/internal interface for a later milestone |
| `queries/get-insights.ts` | `trpc/get-insights.ts` |
| `queries/get-mentionable-users.ts` | `trpc/get-mentionable-users.ts` |
| `queries/get-settings.ts` | `lib/settings.ts`, `queries/update-settings.ts`, `trpc/get-settings.ts` |
| `queries/get-user-session.ts` | `trpc/get-user-session.ts` |
| `queries/redeem-admin-invite.ts` | `trpc/redeem-admin-invite.ts` |
| `queries/reply-parent.ts` | `queries/create-comment.ts` |
| `queries/save-insights.ts` | No active importer; retained typed/internal interface for a later milestone |
| `queries/set-activities-seen.ts` | `trpc/set-activities-seen.ts` |
| `queries/set-all-activities-seen.ts` | `trpc/set-all-activities-seen.ts` |
| `queries/set-insight-status.ts` | `trpc/set-insight-status.ts` |
| `queries/update-comment.ts` | `trpc/update-comment.ts` |
| `queries/update-feedback-post-status.ts` | `trpc/update-feedback-post-status.ts` |
| `queries/update-feedback-post.ts` | `trpc/update-feedback-post.ts` |
| `queries/update-settings.ts` | `trpc/update-settings.ts` |
| `queries/update-user.ts` | `trpc/update-user.ts` |
| `queries/upvote-comment.ts` | `trpc/upvote-comment.ts` |
| `queries/upvote-feedback-post.ts` | `trpc/upvote-feedback-post.ts` |
| `trpc/create-admin-invite.ts` | `trpc/index.ts` |
| `trpc/create-comment.ts` | `trpc/index.ts` |
| `trpc/create-feedback-post.ts` | `trpc/index.ts` |
| `trpc/delete-admin-invite.ts` | `trpc/index.ts` |
| `trpc/delete-admin.ts` | `trpc/index.ts` |
| `trpc/delete-comment.ts` | `trpc/index.ts` |
| `trpc/delete-feedback-post.ts` | `trpc/index.ts` |
| `trpc/generate-insights.ts` | `trpc/index.ts` |
| `trpc/get-activity-feed-meta-data.ts` | `trpc/index.ts` |
| `trpc/get-activity-feed.ts` | `trpc/index.ts` |
| `trpc/get-admin-invite.ts` | `trpc/index.ts` |
| `trpc/get-admins.ts` | `trpc/index.ts` |
| `trpc/get-comment.ts` | `trpc/index.ts` |
| `trpc/get-comments.ts` | `trpc/index.ts` |
| `trpc/get-feedback-post-count.ts` | `trpc/index.ts` |
| `trpc/get-feedback-post.ts` | `trpc/index.ts` |
| `trpc/get-feedback-posts-by-ids.ts` | `trpc/index.ts` |
| `trpc/get-feedback-posts.ts` | `trpc/index.ts` |
| `trpc/get-insights.ts` | `trpc/index.ts` |
| `trpc/get-mentionable-users.ts` | `trpc/index.ts` |
| `trpc/get-settings.ts` | `trpc/index.ts` |
| `trpc/get-user-session.ts` | `trpc/index.ts` |
| `trpc/index.ts` | `app/api/trpc/[trpc]/route.ts`, `providers/trpc-client.tsx` |
| `trpc/redeem-admin-invite.ts` | `trpc/index.ts` |
| `trpc/rewrite-feedback.ts` | `trpc/index.ts` |
| `trpc/set-activities-seen.ts` | `trpc/index.ts` |
| `trpc/set-all-activities-seen.ts` | `trpc/index.ts` |
| `trpc/set-insight-status.ts` | `trpc/index.ts` |
| `trpc/update-comment.ts` | `trpc/index.ts` |
| `trpc/update-feedback-post-status.ts` | `trpc/index.ts` |
| `trpc/update-feedback-post.ts` | `trpc/index.ts` |
| `trpc/update-settings.ts` | `trpc/index.ts` |
| `trpc/update-user.ts` | `trpc/index.ts` |
| `trpc/upvote-comment.ts` | `trpc/index.ts` |
| `trpc/upvote-feedback-post.ts` | `trpc/index.ts` |
