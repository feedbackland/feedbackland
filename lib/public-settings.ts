export type PublicSettings = {
  platformTitle: string;
  platformDescription: string | null;
  logoUrl: string | null;
  allowIndexing: boolean;
  isSetupComplete: boolean;
  appUrl: string;
  appUrlInferred: boolean;
  version: string;
  buildIdentity: string;
  publicVersion: string;
  capabilities: {
    chat: boolean;
    embeddings: boolean;
    smtp: boolean;
    socialProviders: Array<"google" | "microsoft" | "oidc">;
    oidcLabel: string | null;
    maxImageBytes: number;
  };
};
