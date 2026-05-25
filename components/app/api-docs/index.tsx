"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EndpointCard } from "./endpoint-card";
import { Playground } from "./playground";
import { CodeExamples } from "./code-examples";
import { Reference } from "./reference";

export function ApiDocs({ orgId }: { orgId: string }) {
  const [endpointUrl, setEndpointUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEndpointUrl(window.location.origin);
    }
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Programmatically submit feedback to your platform from any service or
        client.
      </p>

      <EndpointCard url={endpointUrl} />

      <Card>
        <CardHeader>
          <CardTitle>Try it</CardTitle>
          <CardDescription>
            Send a real request against the endpoint. A feedback post is
            created on your board; remove it with one click after testing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Playground
            url={endpointUrl}
            orgId={orgId}
            description={description}
            setDescription={setDescription}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Code examples</CardTitle>
          <CardDescription>
            Snippets update live as you edit the description above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeExamples
            url={endpointUrl}
            orgId={orgId}
            description={description}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <Reference />
        </CardContent>
      </Card>
    </div>
  );
}
