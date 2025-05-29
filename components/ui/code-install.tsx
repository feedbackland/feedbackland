"use client";

import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-underlined";
import { useState } from "react";

interface CodeProps {
  packageName: string;
  className?: React.ComponentProps<"div">["className"];
}

export function CodeInstall({ packageName, className }: CodeProps) {
  const packageManagers = ["npm", "pnpm", "yarn", "bun"];

  const [selectedPackageManager, setSelectedPackageManager] = useState("npm");

  const text = `${selectedPackageManager} ${selectedPackageManager === "npm" ? "i" : "add"} ${packageName}`;

  return (
    <div
      className={cn(
        "border-border relative overflow-hidden rounded-lg border bg-black text-white shadow-xs",
        className,
      )}
    >
      <CopyButton className="absolute! top-1 right-1.5" text={text} />

      <Tabs
        value={selectedPackageManager}
        onValueChange={setSelectedPackageManager}
      >
        <TabsList className="border-muted-foreground px-4">
          {packageManagers.map((packageManager) => {
            return (
              <TabsTrigger
                key={packageManager}
                value={packageManager}
                className="text-xs data-[state=active]:border-b-white data-[state=active]:bg-transparent data-[state=active]:text-white"
              >
                {packageManager}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {packageManagers.map((packageManager) => {
          return (
            <TabsContent
              key={packageManager}
              value={packageManager}
              className="px-4 pt-2 pb-4 font-mono text-sm"
            >
              <pre>
                <code>{text}</code>
              </pre>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
