import { z } from "zod";
import { subdomainRegex, reservedSubdomains } from "@/lib/utils";

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
  email: z.string().email(),
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

export const orgSubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Please provide a URL")
  .max(63, "URL must be at most 63 characters")
  .regex(
    subdomainRegex,
    "URL is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods.",
  )
  .refine(
    (value) => !reservedSubdomains.includes(value),
    "This URL is reserved for internal use",
  )
  .refine(
    (value) => {
      // Check if the value IS a valid UUID v4
      const isUuidV4 = z.string().uuid().safeParse(value).success;
      // We want the validation to pass if it's NOT a UUID v4
      return !isUuidV4;
    },
    {
      message: "Subdomain must not be a UUID v4.",
    },
  );
