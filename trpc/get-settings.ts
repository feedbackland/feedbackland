import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { getSettingsQuery } from "@/queries/get-settings";
export const getSettings = adminProcedure.query(() => getSettingsQuery());
