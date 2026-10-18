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
    maxOutputBytes?: number;
  } = {},
): Promise<string> {
  const timeout = options.timeout ?? 120_000;
  const limit = options.maxOutputBytes ?? 8 * 1024 * 1024;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1
  )
    throw new Error(
      "Command timeout and output limit must be positive integers",
    );
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: toolEnvironment(options.env),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let termination: string | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const stop = (reason: string) => {
      if (termination) return;
      termination = reason;
      child.kill();
      forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
      forceKill.unref();
    };
    const capture = (data: Buffer) => {
      if (termination) return;
      const remaining = limit - size;
      if (remaining > 0) {
        const retained = data.subarray(0, remaining);
        chunks.push(retained);
        size += retained.length;
      }
      if (data.length > remaining)
        stop(`exceeded output limit of ${limit} bytes`);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => {
      stop(`timed out after ${timeout}ms`);
    }, timeout);
    child.on("error", (error) => {
      clearTimeout(timer);
      clearTimeout(forceKill);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(forceKill);
      const output = Buffer.concat(chunks, size).toString("utf8").trim();
      if (termination)
        reject(
          new Error(`${program} ${args[0] ?? ""} ${termination}:\n${output}`),
        );
      else if (code === 0) resolve(output);
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
