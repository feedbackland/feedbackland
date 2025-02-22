import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackFormContainer } from "@/components/app/feedback-form/container";

export default function OrgPage() {
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
            <FeedbackFormContainer />
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
