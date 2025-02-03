import { Code } from "@/components/ui/code";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-underlined";

const overlayWidgetCode = `import React, { useState } from 'react';

export function TodoList() {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Todo List</h2>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          text={todo.text}
          completed={todo.completed}
          onToggle={() => toggleTodo(todo.id)}
        />
      ))}
    </div>
  );
}`;

const inlineWidgetCode = `
  import { InlineWidget } from "feedbackland/react";

  function App() {
    return <InlineWidget id=”12323-2323-2323” />;
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
        <Code
          title="App.tsx"
          code={overlayWidgetCode}
          showLineNumbers={true}
          language="tsx"
        />
      </TabsContent>
      <TabsContent value="inline-react">
        <Code
          title="App.tsx"
          code={inlineWidgetCode}
          showLineNumbers={true}
          language="tsx"
        />
      </TabsContent>
    </Tabs>
  );
}
