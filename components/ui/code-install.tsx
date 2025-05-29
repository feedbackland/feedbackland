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

export function CodeInstall({
  packageName,
  className,
}: {
  packageName: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const packageManagers = ["npm", "pnpm", "yarn", "bun"];

  const [selectedPackageManager, setSelectedPackageManager] = useState("npm");

  const text = `${selectedPackageManager} ${selectedPackageManager === "npm" ? "i" : "add"} ${packageName}`;

  return (
    <div
      className={cn(
        "border-border relative overflow-hidden rounded-lg border bg-black pt-1 shadow-xs",
        className,
      )}
    >
      <CopyButton
        className="hover:bg-muted-foreground/50 absolute! top-1 right-1.5 size-fit bg-black p-2 text-white hover:text-white"
        text={text}
      />

      <Tabs
        value={selectedPackageManager}
        onValueChange={setSelectedPackageManager}
      >
        <TabsList className="border-muted-foreground! dark:border-border! px-4">
          {packageManagers.map((packageManager) => {
            return (
              <TabsTrigger
                key={packageManager}
                value={packageManager}
                className="px-0 text-xs data-[state=active]:border-b-white data-[state=active]:bg-transparent data-[state=active]:text-white"
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
              className="px-4 pt-2 pb-4"
            >
              <pre className="font-mono text-xs text-white">
                <code>{text}</code>
              </pre>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
