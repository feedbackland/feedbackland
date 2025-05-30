import { z } from "zod";
import { orgSubdomainSchema } from "@/lib/schemas";

export const createOrgSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(1, "Please provide a company or product name")
    .max(200, "Company or product must be at most 200 characters"),
  orgSubdomain: orgSubdomainSchema,
});
