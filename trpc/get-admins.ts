import { z } from "zod";
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
