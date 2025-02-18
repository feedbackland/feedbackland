import { z } from "zod";
import { subdomainRegex, reservedSubdomains } from "@/lib/utils";

export const createOrgSchema = z.object({
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
      "Subdomain is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods.",
    )
    .refine(
      (value) => !reservedSubdomains.includes(value),
      "Subdomain is reserved for internal use",
    ),
});
