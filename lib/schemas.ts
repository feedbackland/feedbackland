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
