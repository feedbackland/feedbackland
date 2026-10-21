import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { getAdminsQuery } from "@/queries/get-admins";

export const getAdmins = adminProcedure.query(async () => {
  try {
    const admins = await getAdminsQuery();

    return admins;
  } catch (error) {
    throw error;
  }
});
