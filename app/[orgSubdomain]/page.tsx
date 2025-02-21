"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { FeedbackForm } from "@/components/app/feedback-form/form";
import { FeedbackFormBanner } from "@/components/app/feedback-form/banner";

export default function OrgPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="mt-10">
      <Tabs defaultValue="ideas" className="w-full">
        <TabsList>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="ideas">
          <div className="mt-4">
            {!isFormOpen ? (
              <FeedbackFormBanner
                bannerText="Have an idea..."
                buttonText="Share your idea"
                onClick={() => setIsFormOpen(true)}
              />
            ) : (
              <FeedbackForm onClose={() => setIsFormOpen(false)} />
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
