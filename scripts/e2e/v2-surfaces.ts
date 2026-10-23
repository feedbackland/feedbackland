import { command } from "./run";
export async function phaseTwo(
  image: string,
  artifacts: string,
  check: (name: string, action: () => Promise<unknown>) => Promise<void>,
) {
  await check("surface/static-ssr-content", async () => {
    await command(process.execPath, [
      "--import",
      "tsx",
      "scripts/e2e/surface-invariants.tsx",
    ]);
    await command(process.execPath, [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/e2e/surface-content.ts",
    ]);
    return {
      unresolvedSsr: "passed",
      statusLabels: "passed",
      clipboardScope: "passed",
    };
  });
  await check("surface/drawer-navigation-isolation-clipboard", async () => {
    const output = await command(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/drawer-auth-check.ts",
        "--image",
        image,
        "--artifacts",
        artifacts,
      ],
      { timeout: 600_000 },
    );
    return JSON.parse(output.split(/\r?\n/).at(-1)!);
  });
}
