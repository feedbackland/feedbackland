"use client";
import { contentMessage } from "@/lib/content-message";

import { hasPendingUpload } from "@/components/ui/minimal-tiptap/upload";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tiptap } from "@/components/ui/tiptap";
import { Input } from "@/components/ui/input";
import { z } from "zod/v4";
import {
  Form,
  FormControl,
  FormField,
  FormLabel,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { cn } from "@/lib/utils";
import { Error } from "@/components/ui/error";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function FeedbackPostEdit({
  postId,
  expectedRevision,
  title,
  description,
  onClose,
  className,
}: {
  postId: string;
  expectedRevision: string;
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

  const [draftRevision] = useState(expectedRevision);
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
  const uploading = hasPendingUpload(
    useWatch({ control, name: "description" }),
  );

  const updatePost = useMutation(
    trpc.updateFeedbackPost.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
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
    if (hasPendingUpload(description)) return;
    setFormState("pending");

    updatePost.mutate({
      postId,
      expectedRevision: draftRevision,
      title,
      description,
    });
  };

  return (
    <Form {...form}>
      <form
        inert={updatePost.isPending}
        aria-busy={updatePost.isPending}
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
                  <Input
                    autoFocus={true}
                    type="text"
                    placeholder="Title"
                    {...field}
                    className="text-sm"
                  />
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
                    disabled={updatePost.isPending}
                    value={field?.value || null}
                    onChange={(value) => field.onChange(value)}
                  />
                </FormControl>
                <FormMessage>{errors.title?.message}</FormMessage>
              </FormItem>
            )}
          />
        </FormItem>

        <p className="text-muted-foreground text-xs">
          Detached images may need to be uploaded again.
        </p>
        <div className="flex items-center space-x-2">
          <Button
            type="submit"
            disabled={uploading}
            loading={formState === "pending"}
            size="sm"
          >
            Save
          </Button>

          <Button type="button" onClick={onClose} variant="outline" size="sm">
            Cancel
          </Button>
        </div>

        {formState === "error" && (
          <Error
            title="Could not save changes"
            description={contentMessage(
              updatePost.error,
              "Could not save the changes. Try again.",
            )}
          />
        )}
      </form>
    </Form>
  );
}
