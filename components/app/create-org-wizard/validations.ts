import { z } from "zod/v4";
import { orgSubdomainSchema } from "@/lib/schemas";

export const createOrgSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(1, "Please provide an organization or product name")
    .max(200, "Organization or product name must be at most 200 characters"),
  orgSubdomain: orgSubdomainSchema,
});
