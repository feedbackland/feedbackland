import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { getAdminsQuery } from "@/queries/get-admins";

export const getAdmins = adminProcedure.query(async ({ ctx: { orgId } }) => {
  try {
    const admins = await getAdminsQuery({
      orgId,
    });

    return admins;
  } catch (error) {
    throw error;
  }
});
