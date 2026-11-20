import { readdir, readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function outboundDestinations(traces) {
  const endpoints = new Map();
  const issues = {};
  let undecoded = 0;
  const issue = (name) => {
    undecoded++;
    issues[name] = (issues[name] ?? 0) + 1;
  };
  for (const trace of traces) {
    for (const line of trace.split("\n")) {
      const call = /^(connect|sendto|sendmsg|sendmmsg)\(/.exec(line)?.[1];
      if (!call) {
        if (/^<\.\.\. (connect|sendto|sendmsg|sendmmsg) resumed>/.test(line))
          issue("unmatched-resume");
        continue;
      }
      const inet = [...line.matchAll(/sa_family=AF_INET6?\b/g)];
      const ports = [...line.matchAll(/\bsin6?_port=htons\((\d+)\)/g)];
      const addresses = [
        ...line.matchAll(
          /(?:inet_addr\(|inet_pton\(AF_INET6, )"([0-9a-f:.]+)"/gi,
        ),
      ];
      const bad =
        inet.length !== ports.length || inet.length !== addresses.length
          ? "address-layout"
          : line.includes("/* unreadable")
            ? "unreadable"
            : line.includes("<unfinished ...>")
              ? "unfinished"
              : call === "sendto" &&
                  inet.length === 0 &&
                  !/,( NULL| \{sa_family=AF_[A-Z0-9_]+\b.*\}), \d+\)/.test(line)
                ? "sendto-address"
                : (call === "sendmsg" || call === "sendmmsg") &&
                    (!line.includes("msg_name=") || /msg_name=0x/.test(line))
                  ? "message-address"
                  : call === "connect" &&
                      !line.includes("sa_family=") &&
                      !/^connect\(\d+, NULL,/.test(line)
                    ? "connect-address"
                    : call === "sendmmsg" && line.includes("}, ...]")
                      ? "abbreviated-message"
                      : null;
      if (bad) {
        issue(call + ":" + bad);
        continue;
      }
      for (const [i, match] of addresses.entries()) {
        const host = match[1].replace(/^::ffff:/i, "");
        if (!isIP(host)) {
          issue(call + ":invalid-destination");
          continue;
        }
        const port = Number(ports[i][1]);
        const key = [call, host, port].join("/");
        const previous = endpoints.get(key);
        endpoints.set(key, {
          call,
          host,
          port,
          count: (previous?.count ?? 0) + 1,
        });
      }
    }
  }
  return { undecoded, issues, endpoints: [...endpoints.values()] };
}

async function main(dir) {
  if ((await readFile(join(dir, "completed"), "utf8")) !== "complete")
    throw new Error("Network trace did not close cleanly");
  const files = (await readdir(dir)).filter((file) =>
    /^network\.\d+$/.test(file),
  );
  if (!files.length) throw new Error("Process tree trace is missing");
  const traces = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  console.log(JSON.stringify(outboundDestinations(traces)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main(process.argv[2]).catch(() => {
    console.error("Incomplete or unreadable network observation");
    process.exitCode = 1;
  });
}
