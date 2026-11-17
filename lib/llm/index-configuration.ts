import { z } from "zod/v4";
const fingerprintSchema = z.object({
  model: z.string(),
  dimensions: z.number().int().min(1).max(4000),
  generation: z.string().regex(/^[1-9][0-9]*$/),
});

export function indexConfiguration(
  stored: unknown,
  model: string,
  dimensions: number,
  widthMismatch: boolean,
  indexesValid?: boolean,
) {
  const fingerprint = fingerprintSchema.safeParse(stored).data;
  const rebuildRequired =
    widthMismatch ||
    indexesValid === false ||
    (!!stored &&
      (!fingerprint ||
        fingerprint.model !== model ||
        fingerprint.dimensions !== dimensions));
  return { fingerprint, rebuildRequired };
}
