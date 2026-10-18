import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
    modules.set(file.replace(/\.ts$/, ""), new Set());
  for (const file of all) {
    const ast = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of ast.statements.filter(ts.isImportDeclaration)) {
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const resolved = specifier.startsWith("@/")
        ? specifier.slice(2)
        : specifier.startsWith("./")
          ? join(file.slice(0, file.lastIndexOf("/")), specifier).replaceAll(
              "\\",
              "/",
            )
          : null;
      if (resolved) modules.get(resolved)?.add(file);
    }
  }
  const rows = [...modules]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([file, callers]) =>
        `| \x60${file}.ts\x60 | ${
          callers.size
            ? [...callers]
                .sort()
                .map((caller) => `\x60${caller}\x60`)
                .join(", ")
            : "No active importer; retained typed/internal interface for a later milestone"
        } |`,
    );
  const output =
    "# P02 query and procedure caller inventory\n\nGenerated from actual TypeScript import declarations by `scripts/caller-inventory.ts`. This records static importers, including the router index; it does not claim dynamic execution or authorization coverage. HTTP authorization and database invariants are exercised by phase-1 verification.\n\n| Module | Importers |\n|---|---|\n" +
    rows.join("\n") +
    "\n";
  const target = process.argv[2];
  if (!target) throw new Error("Supply an output Markdown path");
  await writeFile(target, output);
  console.log(
    `Inventoried ${modules.size} modules across ${all.length} application files`,
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
