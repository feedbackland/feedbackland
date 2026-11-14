import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { getSettingsQuery } from "../queries/get-settings";
import { getAppUrl } from "./app-url";
import type { PublicSettings } from "./public-settings";
import identity from "./build-identity.json";
import { getConfig } from "./config";
import { imageUrl } from "./images/path";
import { canImproveDraft } from "./llm/content-capabilities";
import { authCapabilities } from "./auth/discovery";
export type { PublicSettings } from "./public-settings";
export async function publicSettings(
  requestHeaders: Headers,
): Promise<PublicSettings> {
  const settings = await getSettingsQuery();
  const origin = getAppUrl(requestHeaders);
  const auth = await authCapabilities();
  const payload = {
    platformTitle: settings.platformTitle,
    platformDescription: settings.platformDescription,
    logoUrl: settings.logoImageId ? imageUrl(settings.logoImageId) : null,
    allowIndexing: settings.allowIndexing,
    isSetupComplete: !!settings.setupCompletedAt,
    appUrl: origin.appUrl,
    appUrlInferred: origin.inferred,
    version: identity.version,
    buildIdentity: `${identity.artifactId}:${identity.architecture}`,
    capabilities: {
      chat: !!settings.setupCompletedAt && (await canImproveDraft()),
      embeddings: false,
      ...auth,
      maxImageBytes: getConfig().maxImageBytes,
    },
  } satisfies Omit<PublicSettings, "publicVersion">;
  return {
    ...payload,
    publicVersion: createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex"),
  };
}
export const getSettings = cache(async () => {
  await connection();
  return publicSettings(await headers());
});
