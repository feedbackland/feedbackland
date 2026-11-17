import "server-only";
import type { Migration } from "kysely/migration";
import * as m0001 from "./0001_init";
import * as m0002 from "./0002_password_recovery";
import * as m0003 from "./0003_ai_dispatch";
import * as m0004 from "./0004_moderation_coverage";
import * as m0005 from "./0005_insight_members";
import * as m0006 from "./0006_ai_onboarding";
export const migrations = {
  "0001_init": m0001,
  "0002_password_recovery": m0002,
  "0003_ai_dispatch": m0003,
  "0004_moderation_coverage": m0004,
  "0005_insight_members": m0005,
  "0006_ai_onboarding": m0006,
} satisfies Record<string, Migration>;
