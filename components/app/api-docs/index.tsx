"use client";

import { useEffect, useState } from "react";
import { Code } from "@/components/ui/code";
import { CopyButton } from "@/components/ui/copy-button";
import { EXAMPLE_DESCRIPTION } from "@/lib/api-snippets";
import { CodeExamples } from "./code-examples";
import { EndpointCard } from "./endpoint-card";

const EXAMPLE_RESPONSE = `{
  "id": "8c2e0c4a-3d8e-4f5a-bdc1-2f6a9e10c4e2",
  "title": "Add a dark-mode option to settings",
  "category": "idea",
  "description": ${JSON.stringify(EXAMPLE_DESCRIPTION)},
  "authorId": null,
  "orgId": "<your-org-id>",
  "upvotes": 0,
  "status": null,
  "createdAt": "2026-05-25T14:30:00.000Z",
  "updatedAt": "2026-05-25T14:30:00.000Z"
}`;

const ERROR_RESPONSE = `{
  "error": "..."
}`;

export function ApiDocs({ orgId }: { orgId: string }) {
  const [endpointUrl, setEndpointUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEndpointUrl(window.location.origin);
    }
  }, []);

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground max-w-prose text-sm">
        Submit feedback to your platform programmatically from any service or
        client. The endpoint is public — no authentication required.
      </p>

      <Section title="Endpoint">
        <EndpointCard url={endpointUrl} />
      </Section>

      <Section title="Your organization ID">
        <p className="text-muted-foreground max-w-prose text-sm">
          Pass this value as <Mono>orgId</Mono> in the request body.
        </p>
        <div className="bg-background border-border flex items-center gap-2 rounded-lg border px-3 py-2 shadow-xs">
          <code className="text-foreground flex-1 truncate font-mono text-sm">
            {orgId}
          </code>
          <CopyButton text={orgId} />
        </div>
      </Section>

      <Section title="Example request">
        <CodeExamples url={endpointUrl} orgId={orgId} />
      </Section>

      <Section title="Request body">
        <ParamTable
          rows={[
            {
              field: "orgId",
              type: "string (uuid)",
              description: "Your organization ID, shown above.",
              required: true,
            },
            {
              field: "description",
              type: "string",
              description:
                "The feedback content. 1–10,000 characters. Plain text or HTML accepted.",
              required: true,
            },
          ]}
        />
      </Section>

      <Section title="Response">
        <p className="text-muted-foreground max-w-prose text-sm">
          A <Mono>200</Mono> response returns the created feedback post.
        </p>
        <Code code={EXAMPLE_RESPONSE} lang="json" />
      </Section>

      <Section title="Errors">
        <p className="text-muted-foreground max-w-prose text-sm">
          Validation failures and server errors return <Mono>500</Mono> with a
          JSON body:
        </p>
        <Code code={ERROR_RESPONSE} lang="json" />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

type ParamRow = {
  field: string;
  type: string;
  description: string;
  required: boolean;
};

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
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
          {rows.map((row) => (
            <tr key={row.field} className="border-border border-t align-top">
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="text-foreground font-mono text-xs">
                    {row.field}
                  </code>
                  {row.required && (
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      required
                    </span>
                  )}
                </div>
              </td>
              <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                {row.type}
              </td>
              <td className="text-muted-foreground px-4 py-2.5">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
