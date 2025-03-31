import { z } from "zod";

export const feedbackStatusSchema = z.union([
  z.literal("under consideration"),
  z.literal("in progress"),
  z.literal("done"),
  z.literal("declined"),
  z.null(),
]);

export const feedbackOrderBySchema = z.union([
  z.literal("newest"),
  z.literal("upvotes"),
  z.literal("comments"),
]);

export const feedbackCategorySchema = z.union([
  z.literal("feature request"),
  z.literal("bug report"),
  z.literal("improvement"),
  z.literal("general feedback"),
  z.null(),
]);

export const upsertUserSchema = z.object({
  orgSubdomain: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().min(1).nullable(),
  photoURL: z.string().min(1).nullable(),
});

export const userRoleSchema = z.union([z.literal("user"), z.literal("admin")]);
