import "server-only";
import { log, sqlstate } from "../log";
import { ConfigurationError } from "../config";
import { BootError } from "./errors";
export async function register() {
  try {
    await import("./index").then((module) => module.boot());
  } catch (error) {
    log(
      "boot.fatal",
      {
        sqlstate: sqlstate(error),
        stage:
          error instanceof BootError
            ? error.stage
            : error instanceof ConfigurationError
              ? "configuration"
              : "database",
      },
      "error",
    );
    if (error instanceof ConfigurationError) console.error(error.message);
    if (error instanceof BootError) console.error(error.message);
    // Deliberately don't print error/cause/stack: database errors can contain
    // connection credentials or rejected input. Exit makes restart work.
    console.error(
      "Feedbackland could not start; check database configuration, pgvector availability and the safe boot diagnostics.",
    );
    process.exit(1);
  }
}
