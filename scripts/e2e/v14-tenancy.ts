import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "@typescript/typescript6";
import { command } from "./run";

const roots = [
  "app",
  "lib",
  "components",
  "hooks",
  "providers",
  "queries",
  "trpc",
  "db",
  "scripts",
];
async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : /\.(ts|tsx|mjs|css)$/.test(entry.name)
            ? [join(directory, entry.name).replaceAll("\\", "/")]
            : [],
      ),
    )
  ).flat();
}
function maskEnvironmentLiterals(source: string, expected: string[]) {
  const ast = ts.createSourceFile(
    "config.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let environmentReads = 0,
    arrayReferences = 0;
  const audit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === "AUTH_ENV_TO_NEUTRALISE")
      arrayReferences++;
    if (ts.isIdentifier(node) && node.text === "process") {
      const access = node.parent;
      assert(
        ts.isPropertyAccessExpression(access) &&
          access.name.text === "env" &&
          !access.questionDotToken,
        "Computed/aliased process access in configuration",
      );
      const read = access.parent;
      assert(
        ts.isElementAccessExpression(read) &&
          ts.isIdentifier(read.argumentExpression) &&
          read.argumentExpression.text === "name",
        "Unexpected environment read in configuration",
      );
      environmentReads++;
    }
    if (
      ts.isIdentifier(node) &&
      node.text === "value" &&
      !ts.isVariableDeclaration(node.parent)
    ) {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      const numericHelper =
        owner &&
        ts.isFunctionDeclaration(owner) &&
        owner.name?.text === "integer";
      assert(
        ts.isCallExpression(node.parent) &&
          node.parent.expression === node &&
          node.parent.arguments.length === 1 &&
          (ts.isStringLiteral(node.parent.arguments[0]) ||
            (numericHelper &&
              ts.isIdentifier(node.parent.arguments[0]) &&
              node.parent.arguments[0].text === "name")),
        "Computed/aliased environment name",
      );
    }
    if (
      ts.isIdentifier(node) &&
      node.text === "integer" &&
      !ts.isFunctionDeclaration(node.parent)
    )
      assert(
        ts.isCallExpression(node.parent) &&
          node.parent.expression === node &&
          ts.isStringLiteral(node.parent.arguments[0]),
        "Computed numeric environment name",
      );
    ts.forEachChild(node, audit);
  };
  audit(ast);
  assert.equal(environmentReads, 3);
  assert.equal(
    arrayReferences,
    2,
    "Neutralization array used outside its fixed loop",
  );
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations);
  const declaration = declarations.find(
    (node) => node.name.getText(ast) === "AUTH_ENV_TO_NEUTRALISE",
  );
  assert(
    declaration?.initializer && ts.isCallExpression(declaration.initializer),
  );
  assert.equal(
    declaration.initializer.expression.getText(ast),
    "Object.freeze",
  );
  const argument = declaration.initializer.arguments[0];
  assert(
    ts.isAsExpression(argument) &&
      ts.isArrayLiteralExpression(argument.expression),
  );
  const literals = argument.expression.elements;
  assert(literals.every(ts.isStringLiteral));
  assert.deepEqual(
    literals.map((node) => (node as ts.StringLiteral).text),
    expected,
  );
  const chars = source.split("");
  for (const literal of literals)
    chars.fill(" ", literal.getStart(ast), literal.end);
  return chars.join("");
}
export async function removal() {
  const fixture = JSON.parse(
    await readFile("ci/fixtures/residue.json", "utf8"),
  );
  const expected = JSON.parse(
    await readFile("ci/fixtures/auth-environment.json", "utf8"),
  );
  const pattern = new RegExp(fixture.pattern, "i");
  const sources = [
    ...(await Promise.all(roots.map(files))).flat(),
    "proxy.ts",
    "instrumentation.ts",
    "next.config.ts",
  ];
  const violations: string[] = [];
  for (const file of sources) {
    let source = await readFile(file, "utf8");
    if (/\.(ts|tsx)$/.test(file)) {
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      for (const statement of ast.statements.filter(ts.isImportDeclaration)) {
        if (
          ts.isStringLiteral(statement.moduleSpecifier) &&
          /(?:^|\/)db\/schema$|^\.\/schema$/.test(
            statement.moduleSpecifier.text,
          )
        ) {
          const clause = statement.importClause;
          assert(
            clause &&
              (clause.isTypeOnly ||
                (clause.namedBindings &&
                  ts.isNamedImports(clause.namedBindings) &&
                  clause.namedBindings.elements.every(
                    (binding) => binding.isTypeOnly,
                  ))),
            `Schema imported as a value: ${file}`,
          );
        }
      }
    }
    if (file === "lib/config.ts")
      source = maskEnvironmentLiterals(source, expected);
    if (pattern.test(file) || pattern.test(source)) violations.push(file);
    if (
      !file.startsWith("scripts/") &&
      ![
        "lib/config.ts",
        "instrumentation.ts",
        "next.config.ts",
        "lib/supabase.ts",
      ].includes(file)
    )
      assert.doesNotMatch(
        source,
        /process\s*(?:\?\.|\.)\s*env|process\s*\[/,
        `Environment reader outside configuration: ${file}`,
      );
    if (
      /^(queries|trpc|db)\//.test(file) &&
      !["db/schema.ts", "trpc/index.ts"].includes(file)
    )
      assert(
        source.startsWith('import "server-only";'),
        `Missing import guard: ${file}`,
      );
    assert.doesNotMatch(source, /^\s*["']server-only["'];/m, file);
    if (
      !file.startsWith("scripts/") &&
      !/^(lib\/boot\/|db\/migrations\/|db\/schema.ts$)/.test(file)
    )
      assert.doesNotMatch(source, /instance_secret/, file);
    if (
      !file.startsWith("scripts/") &&
      !/^(lib\/llm\/settings-store.ts$|db\/migrations\/|db\/schema.ts$)/.test(
        file,
      )
    )
      assert.doesNotMatch(source, /ai_settings/, file);
  }
  assert.deepEqual(violations, [], "Residue remains");
  const config = await readFile("lib/config.ts", "utf8");
  assert.throws(() =>
    maskEnvironmentLiterals(config + fixture.maliciousReference, expected),
  );
  assert.throws(() =>
    maskEnvironmentLiterals(config + fixture.maliciousComputed, expected),
  );
  assert(
    pattern.test(
      maskEnvironmentLiterals(config + fixture.maliciousLiteral, expected),
    ),
    "AST exemption masked an extra literal",
  );
  await command(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/e2e/config-invariants.ts",
    ],
    {
      env: Object.fromEntries(
        expected.map((name: string) => [name, "fixture-ignored"]),
      ),
    },
  );
  const changed = new Set(
    (
      await command("git", [
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        process.env.REVIEW_BASE ?? fixture.reviewBase,
      ])
    ).split(/\r?\n/),
  );
  for (const file of (
    await command("git", ["ls-files", "--others", "--exclude-standard"])
  ).split(/\r?\n/))
    changed.add(file);
  const lint = sources.filter(
    (file) =>
      /\.(ts|tsx|mjs)$/.test(file) &&
      file !== "db/schema.ts" &&
      (/^(queries|trpc|db|scripts)\/|^lib\/(auth|boot|llm)\//.test(file) ||
        changed.has(file)),
  );
  await command(
    process.execPath,
    [
      "--require",
      "./scripts/eslint-ts6-resolver.cjs",
      "node_modules/eslint/bin/eslint.js",
      ...lint,
    ],
    { timeout: 180_000 },
  );
  return {
    scannedFiles: sources.length,
    literalExceptions: expected.length,
    computedOrExtraReferences: "rejected",
    actualEnvironmentDeletion: "passed",
    lintedFiles: lint.length,
  };
}
