"use client";

import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface CodeProps {
  packageName: string;
  className?: React.ComponentProps<"div">["className"];
}

const tabsTriggerClassnames = `inline-flex items-center justify-center whitespace-nowrap rounded-none border-b border-transparent bg-transparent p-0 pb-2 font-mono text-xs font-medium text-zinc-400 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-white data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow`;

const tabsContentClassnames = `border-t border-border/20 px-4 py-3 font-mono text-xs`;

const packageManagers = ["npm", "pnpm", "yarn", "bun"];

export function CodeInstall({ packageName, className }: CodeProps) {
  const [selectedPackageManager, setSelectedPackageManager] = useState("npm");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <CopyButton
        className="absolute right-1.5 top-1"
        text={`${selectedPackageManager} add ${packageName}`}
      />

      <Tabs
        value={selectedPackageManager}
        onValueChange={setSelectedPackageManager}
      >
        <TabsList className="inline-flex h-0 translate-y-[2px] items-center justify-center gap-3 rounded-lg bg-transparent p-0 pl-4 text-muted-foreground">
          {packageManagers.map((packageManager) => {
            return (
              <TabsTrigger
                value={packageManager}
                className={tabsTriggerClassnames}
              >
                {packageManager}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {packageManagers.map((packageManager) => {
          return (
            <TabsContent
              value={packageManager}
              className={tabsContentClassnames}
            >
              <pre>
                <code>
                  {packageManager} add {packageName}
                </code>
              </pre>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
