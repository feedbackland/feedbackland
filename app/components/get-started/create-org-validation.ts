import { z } from "zod";
import { subdomainRegex } from "@/app/utils/helpers";

export const createOrgSchema = z.object({
  userId: z.string().min(1, "userId cannot be empty"),
  orgName: z
    .string()
    .min(1, { message: "Please provide a company or product name" })
    .max(200, { message: "Company or product must be at most 200 characters" }),
  orgSubdomain: z
    .string()
    .min(1, { message: "Please provide a subdomain" })
    .max(63, { message: "Subdomain must be at most 63 characters" })
    .regex(subdomainRegex, {
      message:
        "Subdomain is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods.",
    })
    .refine((value) => value.toLowerCase() !== "new", {
      message: "Subdmain cannot be called 'new'",
    }),
});
