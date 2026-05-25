"use client";

import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Code } from "@/components/ui/code";
import { buildCurl, buildJs, buildPython } from "@/lib/api-snippets";

type Language = "curl" | "js" | "python";

const PLACEHOLDER_DESCRIPTION = "Your feedback here";

export function CodeExamples({
  url,
  orgId,
  description,
}: {
  url: string;
  orgId: string;
  description: string;
}) {
  const [language, setLanguage] = useState<Language>("curl");

  const effective =
    description.trim().length > 0 ? description : PLACEHOLDER_DESCRIPTION;

  const params = { url, orgId, description: effective };

  return (
    <Tabs
      value={language}
      onValueChange={(v) => setLanguage(v as Language)}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="curl">cURL</TabsTrigger>
        <TabsTrigger value="js">JavaScript</TabsTrigger>
        <TabsTrigger value="python">Python</TabsTrigger>
      </TabsList>
      <TabsContent value="curl" className="mt-3">
        <Code code={buildCurl(params)} lang="bash" />
      </TabsContent>
      <TabsContent value="js" className="mt-3">
        <Code code={buildJs(params)} lang="javascript" />
      </TabsContent>
      <TabsContent value="python" className="mt-3">
        <Code code={buildPython(params)} lang="python" />
      </TabsContent>
    </Tabs>
  );
}
