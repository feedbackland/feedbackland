import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { z } from "zod";

export const getSubscription = adminProcedure
  .input(z.object({}))
  .query(async ({ ctx: { orgId } }) => {
    try {
      const subscription = getSubscriptionQuery({
        orgId,
      });

      return subscription;
    } catch (error) {
      throw error;
    }
  });
