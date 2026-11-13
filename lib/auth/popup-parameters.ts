import { z } from "zod/v4";

export const popupParameters = z.object({
  provider: z.enum(["google", "microsoft", "oidc"]),
  ticket: z.string().regex(/^[a-f0-9]{32}$/),
  h: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(["embedded", "first-party"]),
});
