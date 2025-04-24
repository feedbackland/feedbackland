"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tiptap } from "@/components/ui/tiptap";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormLabel,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { cn } from "@/lib/utils";
import { Error } from "@/components/ui/error";
import { dequal } from "dequal";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function FeedbackPostEdit({
  postId,
  title,
  description,
  onClose,
  className,
}: {
  postId: string;
  title: string;
  description: string;
  onClose: () => void;
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const [formState, setFormState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title,
      description,
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const updatePost = useMutation(
    trpc.updateFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId }),
        });

        queryClient.invalidateQueries({
          predicate: (query) =>
            dequal(query.queryKey[0], trpc.getFeedbackPosts.queryKey()[0]),
        });

        toast.success("Feedback updated", {
          position: "top-right",
        });

        onClose();
      },
      onError: () => {
        setFormState("error");
      },
    }),
  );

  const onSubmit: SubmitHandler<FormData> = async ({ title, description }) => {
    setFormState("pending");

    updatePost.mutate({
      postId,
      title,
      description,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn("w-full space-y-6", className)}
      >
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input autoFocus type="text" placeholder="Title" {...field} />
                </FormControl>
                <FormMessage>{errors.title?.message}</FormMessage>
              </FormItem>
            )}
          />
        </FormItem>

        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Tiptap
                    value={field?.value}
                    onChange={(value) => field.onChange(value)}
                    showToolbar={false}
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormMessage>{errors.title?.message}</FormMessage>
              </FormItem>
            )}
          />
        </FormItem>

        <div className="flex items-center space-x-2">
          <Button type="submit" loading={formState === "pending"}>
            Save
          </Button>

          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
        </div>

        {formState === "error" && (
          <Error
            title="Could not save changes"
            description="An error occured while trying to save your changes. Please try again."
          />
        )}
      </form>
    </Form>
  );
}
