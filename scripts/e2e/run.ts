import { spawn } from "node:child_process";

/** Child tools receive OS/tool configuration, never inherited app credentials. */
export function toolEnvironment(
  extra: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const allowed =
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|DOCKER_CONFIG|DOCKER_CONTEXT|DOCKER_HOST|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH|CI|GITHUB_ACTIONS)$/i;
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => allowed.test(key)),
    ),
    NODE_ENV: "test",
    NEXT_TELEMETRY_DISABLED: "1",
    ...extra,
  };
}

export async function command(
  program: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeout?: number;
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: toolEnvironment(options.env),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const capture = (data: Buffer) => {
      output += data.toString();
      if (output.length > 8 * 1024 * 1024) child.kill();
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => {
      child.kill();
    }, options.timeout ?? 120_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim());
      else
        reject(
          new Error(`${program} ${args[0] ?? ""} failed (${code}):\n${output}`),
        );
    });
  });
}

export async function eventually<T>(
  action: () => Promise<T>,
  accept: (value: T) => boolean,
  timeout = 60_000,
): Promise<T> {
  const end = Date.now() + timeout;
  let last: unknown;
  do {
    try {
      const value = await action();
      if (accept(value)) return value;
      last = value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  } while (Date.now() < end);
  throw new Error(`condition not met within ${timeout}ms: ${String(last)}`);
}
