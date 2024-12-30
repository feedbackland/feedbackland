import { defineConfig } from "kysely-ctl";
import { dialect } from "../app/db/db";

export default defineConfig({
  dialect,
});
