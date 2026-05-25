"use client";

const StatusBadge = ({
  status,
  tone,
}: {
  status: string;
  tone: "success" | "error";
}) => (
  <span
    className={
      tone === "success"
        ? "inline-flex items-center rounded-md bg-green-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300"
        : "inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"
    }
  >
    {status}
  </span>
);

export function Reference() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Request body</h3>
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr className="text-left">
                <th scope="col" className="px-4 py-2 font-medium">
                  Field
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-border border-t">
                <td className="px-4 py-2.5 font-mono text-xs">orgId</td>
                <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                  uuid
                </td>
                <td className="text-muted-foreground px-4 py-2.5">
                  Your organization ID.{" "}
                  <span className="text-foreground">Required.</span>
                </td>
              </tr>
              <tr className="border-border border-t">
                <td className="px-4 py-2.5 font-mono text-xs">description</td>
                <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                  string
                </td>
                <td className="text-muted-foreground px-4 py-2.5">
                  Feedback content, 1–10,000 characters. Plain text or HTML are
                  both accepted.{" "}
                  <span className="text-foreground">Required.</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Responses</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <StatusBadge status="200" tone="success" />
            <span className="text-muted-foreground">
              Returns the created feedback post — including the generated{" "}
              <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
                id
              </code>
              ,{" "}
              <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
                title
              </code>
              , and{" "}
              <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
                category
              </code>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <StatusBadge status="500" tone="error" />
            <span className="text-muted-foreground">
              Validation or server error. Body shape:{" "}
              <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
                {`{ "error": string }`}
              </code>
              .
            </span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">CORS</h3>
        <p className="text-muted-foreground text-sm">
          The endpoint is callable from any origin (
          <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
            Access-Control-Allow-Origin: *
          </code>
          ), so you can invoke it from browser, server, or mobile clients
          alike.
        </p>
      </section>
    </div>
  );
}
