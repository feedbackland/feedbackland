import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "@typescript/typescript6";
async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : /\.(ts|tsx)$/.test(entry.name)
            ? [join(directory, entry.name).replaceAll("\\", "/")]
            : [],
      ),
    )
  ).flat();
}
async function main() {
  const base = resolve(".");
  const canonical = (file: string) => {
    const absolute = resolve(file).replaceAll("\\", "/");
    return ts.sys.useCaseSensitiveFileNames ? absolute : absolute.toLowerCase();
  };
  const configFile = ts.readConfigFile(
    join(base, "tsconfig.json"),
    ts.sys.readFile,
  );
  if (configFile.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
    );
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, base);
  if (config.errors.length)
    throw new Error(
      config.errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        )
        .join("\n"),
    );
  const all = (
    await Promise.all(
      [
        "app",
        "components",
        "hooks",
        "lib",
        "providers",
        "queries",
        "trpc",
        "db",
      ].map(files),
    )
  ).flat();
  const modules = new Map<string, Set<string>>();
  for (const file of all.filter((file) => /^(queries|trpc)\//.test(file)))
    modules.set(file, new Set());
  const modulePaths = new Map(
    [...modules.keys()].map((file) => [canonical(file), file]),
  );
  for (const file of all) {
    const ast = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of ast.statements) {
      if (
        !(
          ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const specifier = statement.moduleSpecifier.text;
      const resolved = ts.resolveModuleName(
        specifier,
        resolve(file),
        config.options,
        ts.sys,
      ).resolvedModule;
      const target =
        resolved && modulePaths.get(canonical(resolved.resolvedFileName));
      if (target) modules.get(target)?.add(file);
    }
  }
  const rows = [...modules]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([file, callers]) =>
        `| \x60${file}\x60 | ${
          callers.size
            ? [...callers]
                .sort()
                .map((caller) => `\x60${caller}\x60`)
                .join(", ")
            : "No active importer; retained typed/internal interface for a later milestone"
        } |`,
    );
  const output =
    "# P02 query and procedure caller inventory\n\nGenerated from TypeScript import and re-export declarations using tsconfig module resolution by `scripts/caller-inventory.ts`. This records static importers, including the router index; it does not claim dynamic execution or authorization coverage. HTTP authorization and database invariants are exercised by phase-1 verification.\n\n| Module | Importers |\n|---|---|\n" +
    rows.join("\n") +
    "\n";
  const target = process.argv[2];
  if (!target) throw new Error("Supply an output Markdown path");
  if (process.argv.includes("--verify")) {
    if ((await readFile(target, "utf8")).replaceAll("\r\n", "\n") !== output)
      throw new Error(
        "Caller inventory is stale; regenerate it with scripts/caller-inventory.ts",
      );
  } else await writeFile(target, output);
  console.log(
    `Inventoried ${modules.size} modules across ${all.length} application files`,
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
