"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSafeActionClient } from "next-safe-action";

const actionClient = createSafeActionClient();

const revalidatePathSchema = z.object({
  path: z
    .string()
    .min(1, "Path must not be empty")
    .refine((path) => path.startsWith("/") || path === "*", {
      message: "Path must start with a '/' or be '*'",
    }),
  type: z
    .enum(["page", "layout"])
    .optional()
    .describe("Specifies whether to revalidate only the page or its layout"),
});

export const revalidatePathAction = actionClient
  .schema(revalidatePathSchema)
  .action(async ({ parsedInput: { path, type } }) => {
    revalidatePath(path, type);
  });
