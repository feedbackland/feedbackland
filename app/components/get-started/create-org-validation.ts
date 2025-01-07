import { z } from "zod";
import { subdomainRegex } from "@/app/utils/helpers";

export const createOrgSchema = z.object({
  userId: z.string().min(1),
  orgName: z
    .string()
    .trim()
    .min(1, "Please provide a company or product name")
    .max(200, "Company or product must be at most 200 characters"),
  orgSubdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Please provide a subdomain")
    .max(63, "Subdomain must be at most 63 characters")
    .regex(
      subdomainRegex,
      "Subdomain is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods."
    )
    .refine((value) => value !== "new", "Subdmain cannot be called 'new'"),
});
