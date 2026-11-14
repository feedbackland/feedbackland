import "server-only";
import type { Migration } from "kysely/migration";
import * as m0001 from "./0001_init";
import * as m0002 from "./0002_password_recovery";
import * as m0003 from "./0003_ai_dispatch";
export const migrations = {
  "0001_init": m0001,
  "0002_password_recovery": m0002,
  "0003_ai_dispatch": m0003,
} satisfies Record<string, Migration>;
