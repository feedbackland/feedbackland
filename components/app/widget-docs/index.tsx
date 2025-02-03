"use client";

import { BasicCodeBlock } from "@/components/ui/basic-code-block";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-alt";

const code = `
  import { OverlayWidget } from "feedbackland/react";

  function App() {
    return (
      <div>
         <Button onClick={() => setIsOpen(true)}>Feedback</Button>
         <SlideInWidget 
          id=”12323-2323-2323”
          open={isOpen}
          onClose={() => setIsOpen(false)}
          mode=”light” // can be either “light”, “dark” or “system”
          />
      </div>
    );
  }
`;

export function WidgetDocs() {
  return (
    <Tabs defaultValue="overlay-react">
      <TabsList className="">
        <TabsTrigger value="overlay-react">Overlay widget (React)</TabsTrigger>
        <TabsTrigger value="inline-react">Inline Widget (React)</TabsTrigger>
      </TabsList>
      <TabsContent value="overlay-react">
        <BasicCodeBlock code={code} />
      </TabsContent>
      <TabsContent value="inline-react"></TabsContent>
    </Tabs>
  );
}
