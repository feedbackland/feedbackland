import { z } from "zod";
import { feedbackOrderBySchema, feedbackStatusSchema } from "./schemas";

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export type FeedbackOrderBy = z.infer<typeof feedbackOrderBySchema>;
