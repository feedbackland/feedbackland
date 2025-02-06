"use client";

import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CodeProps {
  code: string;
  className?: React.ComponentProps<"div">["className"];
}

const tabsTriggerClasnames = `inline-flex items-center justify-center whitespace-nowrap rounded-none border-b border-transparent bg-transparent p-0 pb-2 font-mono text-xs font-medium text-zinc-400 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-white data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow`;

const tabsContentClassnames = `border-t border-border/20 px-4 py-3 font-mono text-xs`;

export function CodeInstall({ code, className }: CodeProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <CopyButton className="absolute right-1.5 top-1" text={code} />

      <Tabs defaultValue="npm" className="">
        <TabsList className="inline-flex h-0 translate-y-[2px] items-center justify-center gap-3 rounded-lg bg-transparent p-0 pl-4 text-muted-foreground">
          <TabsTrigger value="npm" className={tabsTriggerClasnames}>
            npm
          </TabsTrigger>
          <TabsTrigger value="pnpm" className={tabsTriggerClasnames}>
            pnpm
          </TabsTrigger>
        </TabsList>
        <TabsContent value="npm" className={tabsContentClassnames}>
          <pre>
            <code>npm install feedbackland/react</code>
          </pre>
        </TabsContent>
        <TabsContent value="pnpm" className={tabsContentClassnames}>
          <pre>
            <code>pnpm install feedbackland/react</code>
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
