import { z } from "zod";
import { orgSubdomainSchema } from "@/lib/schemas";

export const createOrgSchema = z.object({
  orgSubdomain: orgSubdomainSchema,
});
