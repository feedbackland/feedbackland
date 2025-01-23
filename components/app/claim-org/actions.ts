"use server";

import { actionClient } from "@/lib/server/safe-action";
import { z } from "zod";
import { db } from "@/db/db";

export const claimOrgAction = actionClient
  .schema(
    z.object({
      userId: z.string().min(1),
      orgId: z.string().min(1),
    })
  )
  .action(async ({ parsedInput: { userId, orgId } }) => {
    try {
      await db
        .insertInto("user_org")
        .values({
          user_id: userId,
          org_id: orgId,
          role: "admin",
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return { success: true, message: "Org claimedsuccessfully!" };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error?.message
            : "An unknown error occured trying to claim the org",
      };
    }
  });
