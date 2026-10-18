import "server-only";
import type { Migration } from "kysely/migration";
import * as m0001 from "./0001_init";
export const migrations = { "0001_init": m0001 } satisfies Record<
  string,
  Migration
>;
