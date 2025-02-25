import { z } from "zod";

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(1, "Please provide a title"),
  description: z.string().trim().min(1, "Please provide a description"),
});
