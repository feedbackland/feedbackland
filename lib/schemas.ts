import { z } from "zod";

export const feedbackStatusSchema = z
  .enum(["under consideration", "planned", "in progress", "done", "declined"])
  .nullable();

export const feedbackOrderBySchema = z
  .enum(["newest", "upvotes", "comments"])
  .nullable();

export const feedbackCategorySchema = z
  .enum(["feature request", "bug report", "general feedback"])
  .nullable();

export const feedbackCategoriesSchema = z
  .array(z.enum(["feature request", "bug report", "general feedback"]))
  .nonempty()
  .nullable();

export const activityFeedTypeSchema = z.enum(["post", "comment"]).nullable();

export const upsertUserSchema = z.object({
  orgSubdomain: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().min(1).nullable(),
  photoURL: z.string().min(1).nullable(),
});

export const upsertOrgSchema = z.object({
  orgId: z.string().uuid(),
});

export const userRoleSchema = z.enum(["user", "admin"]);

export const feedbackPostsCursorSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    commentCount: z.number().min(0),
    upvotes: z.number().min(0),
    distance: z.number().optional(),
  })
  .nullish();

export const insightsCursorSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    priority: z.number().min(0),
  })
  .nullish();
