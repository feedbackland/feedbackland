import { z } from "zod";
import { publicProcedure, userProcedure, router } from "./trpc";
import { createFeedbackQuery } from "@/queries/create-feedback";

export const appRouter = router({
  getOrg: publicProcedure.query(async ({ ctx }) => {
    return ctx?.org || null;
  }),
  postFeedback: userProcedure
    .input(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ input: { title, description }, ctx }) => {
      try {
        const authorId = ctx?.user?.uid;
        const orgId = ctx?.org?.id;

        if (!authorId || !orgId) {
          throw new Error("No authorId or orgId provided");
        }

        await createFeedbackQuery({
          title,
          description,
          authorId,
          orgId,
        });

        return { success: true, message: "Post created successfully!" };
      } catch (error) {
        console.log("userProcedure error", error);
        throw error;
      }
    }),
});

export type AppRouter = typeof appRouter;
