import { defineConfig } from "kysely-ctl";
import { dialect } from "../db/db";

export default defineConfig({
  dialect,
});
