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
import { XIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { TextareaAutoResize } from "@/components/ui/textarea-autoresize";

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

  const [isPending, setIsPending] = useState(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true);

    try {
      const processedDescription = await processImagesInHTML(
        values.description,
      );
      console.log("processedDescription", processedDescription);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="relative rounded-lg border border-border bg-background p-4 shadow-sm">
      {/* <Button
        size="icon"
        variant="ghost"
        className="absolute right-3 top-3"
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </Button> */}
      <div className="flex flex-col">
        {/* <h3 className="h4 mb-5">What&apos;s your idea?</h3> */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Title</FormLabel>
                  <FormControl>
                    <TextareaAutoResize
                      autoFocus
                      placeholder="Title of your idea"
                      className="min-h-0 w-full border-none bg-background !p-0 !text-xl font-bold shadow-none focus-visible:ring-0"
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
                  <FormLabel className="sr-only">Description</FormLabel>
                  <FormControl>
                    <Tiptap
                      placeholder="Description of your idea"
                      onChange={(value) => {
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="my-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button className="" type="submit" loading={isPending}>
                <SendIcon className="size-4" />
                Submit idea
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
