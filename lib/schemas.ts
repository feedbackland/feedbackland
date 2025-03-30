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
