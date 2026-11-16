import { z } from "zod/v4";
export const feedbackStatusSchema = z
  .enum(["under consideration", "planned", "in progress", "done", "declined"])
  .nullable();

export const feedbackOrderBySchema = z
  .enum(["newest", "upvotes", "comments"])
  .nullable();

export const feedbackCategorySchema = z
  .enum(["idea", "issue", "general feedback"])
  .nullable();

export const feedbackCategoriesSchema = z
  .array(feedbackCategorySchema)
  .nullable();

export const activityFeedTypeSchema = z.enum(["post", "comment"]).nullable();

export const userRoleSchema = z.enum(["user", "admin"]);

export const searchCapabilitySchema = z
  .string()
  .regex(/^[0-9a-f]{64}(?:\.\d{13}\.[0-9a-f]{64})?$/);
export const searchCursorSchema = z.object({
  capability: searchCapabilitySchema,
  nextOrdinal: z.number().int().min(0).max(1000),
});
export const feedbackPostsCursorSchema = z
  .union([
    searchCursorSchema,
    z.object({
      id: z.string(),
      createdAt: z.iso.datetime({ offset: true }),
      commentCount: z.number().min(0),
      upvotes: z.number().min(0),
      distance: z.number().optional(),
    }),
  ])
  .nullish();

/** Rough size of an insight: small, medium, large. Set by the model. */
export const insightEffortSchema = z.enum(["s", "m", "l"]).nullable();
