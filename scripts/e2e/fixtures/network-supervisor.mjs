import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const child = spawn("/observer/strace", process.argv.slice(2), {
  detached: true,
  stdio: ["ignore", "inherit", "pipe"],
});
let stopping = false;
let tracerError = false;
let tail = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (data) => {
  const lines = (tail + data).split("\n");
  tail = (lines.pop() ?? "").slice(-1024);
  if (lines.some((line) => line.includes("strace:"))) tracerError = true;
  process.stderr.write(data);
});
child.on("error", () => {
  tracerError = true;
});

function stop() {
  if (
    stopping ||
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return;
  try {
    process.kill(-child.pid, "SIGTERM");
    stopping = true;
  } catch {
    tracerError = true;
  }
}
process.on("SIGUSR1", stop);
process.on("SIGTERM", stop);
child.on("close", (code, signal) => {
  const integrity =
    stopping &&
    !tracerError &&
    !tail.includes("strace:") &&
    (code === 0 || code === 143 || signal === "SIGTERM");
  void writeFile("/trace/completed", integrity ? "complete" : "failed").catch(
    () => {
      process.exitCode = 1;
    },
  );
});
// Keep the private tmpfs mounted for the endpoint-only reader.
setInterval(() => {}, 10000);
