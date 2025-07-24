import { z } from "zod/v4";
import { orgSubdomainSchema } from "@/lib/schemas";

export const createOrgSchema = z.object({
  orgSubdomain: orgSubdomainSchema,
});
