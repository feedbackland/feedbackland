import { readdir, readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function outboundDestinations(traces) {
  const endpoints = new Map();
  let undecoded = 0;
  for (const trace of traces) {
    for (const line of trace.split("\n")) {
      const call = /^(connect|sendto|sendmsg|sendmmsg)\(/.exec(line)?.[1];
      if (!call) continue;
      const inet = [...line.matchAll(/sa_family=AF_INET6?\b/g)];
      const ports = [...line.matchAll(/\bsin6?_port=htons\((\d+)\)/g)];
      const addresses = [
        ...line.matchAll(
          /(?:inet_addr\(|inet_pton\(AF_INET6, )"([0-9a-f:.]+)"/gi,
        ),
      ];
      if (
        inet.length !== ports.length ||
        inet.length !== addresses.length ||
        line.includes("/* unreadable") ||
        (call === "connect" &&
          !line.includes("sa_family=") &&
          !/^connect\(\d+, NULL,/.test(line)) ||
        (call === "sendmmsg" && line.includes("}, ...]"))
      ) {
        undecoded++;
        continue;
      }
      for (const [i, match] of addresses.entries()) {
        const host = match[1].replace(/^::ffff:/i, "");
        if (!isIP(host)) {
          undecoded++;
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
  return { undecoded, endpoints: [...endpoints.values()] };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dir = process.argv[2];
  const files = (await readdir(dir)).filter((file) =>
    /^network\.\d+$/.test(file),
  );
  if (!files.length) throw new Error("Process tree trace is missing");
  const traces = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  console.log(JSON.stringify(outboundDestinations(traces)));
}
