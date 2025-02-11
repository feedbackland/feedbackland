"use server";

import { actionClient } from "@/lib/server/safe-action";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export const revalidatePathAction = actionClient
  .schema(
    z.object({
      path: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput: { path } }) => {
    revalidatePath(path);
    return { success: true };
  });
