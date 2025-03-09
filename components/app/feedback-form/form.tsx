"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tiptap } from "@/components/ui/tiptap";
import { processImagesInHTML } from "@/lib/utils";
import { SendIcon } from "lucide-react";
// import { TextareaAutoResize } from "@/components/ui/textarea-autoresize";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";

export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();

  const formSchema = z.object({
    // title: z.string().trim().min(1, "Please provide a title"),
    description: z.string().trim().min(1, "Please provide a description"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      // title: "",
      description: "",
    },
  });

  const saveFeedback = useMutation(
    trpc.createFeedbackPost.mutationOptions({
      onSuccess: () => {
        form.reset();
      },
      onError: (error) => {
        console.error("useMutation error", error);
      },
    }),
  );

  const onSubmit = async ({ description }: z.infer<typeof formSchema>) => {
    const processedDescription = await processImagesInHTML(description);

    saveFeedback.mutate({
      description: processedDescription,
    });
  };

  return (
    <div className="relative rounded-lg border border-primary bg-background px-4 py-3 shadow-sm">
      {/* <Button
        size="icon"
        variant="ghost"
        className="absolute right-2.5 top-2.5"
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </Button> */}
      <div className="flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Title</FormLabel>
                  <FormControl>
                    <TextareaAutoResize
                      autoFocus
                      placeholder="The title of your feedback"
                      className="min-h-0 w-full border-none bg-background !p-0 !text-xl font-bold shadow-none focus-visible:ring-0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Description</FormLabel>
                  <FormControl>
                    <Tiptap
                      // placeholder={`Description of your feedback. This can be...
                      // • a feature request
                      // • a bug report
                      // • or anything else that's on your mind`}
                      // placeholder={`Description of your feedback, i.e. a feature request, bug report, or anything else that's on your mind`}
                      // placeholder={`The description of your feature request, bug report, or anything else that's on your mind`}
                      placeholder={`The description of your feature request, suggestion, issue, ...`}
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
              <Button
                type="submit"
                size="icon"
                loading={saveFeedback.isPending}
                className="order-2"
              >
                <SendIcon className="size-4" />
                {/* Submit */}
              </Button>
              {/* <Button variant="secondary" onClick={onClose} className="order-1">
                Close
              </Button> */}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
