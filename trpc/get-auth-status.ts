import "server-only";
import { adminProcedure } from "../lib/trpc";
import { authStatus } from "../lib/auth/discovery";
export const getAuthStatus = adminProcedure.query(() => authStatus());
