import { publicProcedure } from "@/lib/trpc";
import { getAdminCountQuery } from "@/queries/get-admins";

export const getAdminCount = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const adminCount = await getAdminCountQuery({
        orgId,
      });

      return adminCount;
    } catch (error) {
      throw error;
    }
  },
);
