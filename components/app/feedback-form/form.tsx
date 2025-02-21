"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { processImagesInHTML } from "@/lib/utils";
import { XIcon } from "lucide-react";

export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const formSchema = z.object({
    title: z.string().trim().min(1, "Please provide a title"),
    description: z.string().trim().min(1, "Please provide a description"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const processedDescription = await processImagesInHTML(
        values.description,
      );

      console.log("processedDescription", processedDescription);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  }

  return (
    <div className="relative flex flex-col space-y-6 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-3 top-3 p-6"
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </Button>
      <h3 className="h4">What&apos;s your idea?</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    placeholder="The title of your feedback"
                    className="w-full bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Tiptap
                    placeholder="The description of your feedback"
                    onChange={(value) => {
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className="my-4" type="submit">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
}
