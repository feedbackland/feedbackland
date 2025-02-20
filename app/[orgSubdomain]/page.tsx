"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

export default function OrgPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div>
      <Tabs defaultValue="ideas" className="w-full">
        <TabsList>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="ideas">
          <div className="mt-4">
            {!isFormOpen ? (
              // <Input
              //   placeholder="Add an idea"
              //   type="text"
              //   className="w-full"
              //   onClick={() => {
              //     setIsFormOpen(true);
              //   }}
              // />
              <div
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-colors ease-out hover:border hover:border-primary"
                onClick={() => {
                  setIsFormOpen(true);
                }}
              >
                <span className="text-sm text-foreground">
                  Have an idea for an improvement, a new feature,... ? Share it
                  here.
                </span>
                <Button size="sm">
                  <PlusIcon className="size-4" />
                  Share your idea
                </Button>
              </div>
            ) : (
              <div className="relative h-[500px] w-full rounded-lg border border-border bg-secondary shadow">
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-3 top-3 p-6"
                  onClick={() => {
                    setIsFormOpen(false);
                  }}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="issues">
          <div>Issues</div>
        </TabsContent>
        <TabsContent value="questions">
          <div>Questions</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
