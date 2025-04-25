"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tiptap } from "@/components/ui/tiptap";
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

const formSchema = z.object({
  content: z.string().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function CommentEdit({
  commentId,
  content,
  onClose,
  className,
}: {
  postId: string;
  commentId: string;
  content: string;
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
      content,
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const updateComment = useMutation(
    trpc.updateComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getComment.queryKey({ commentId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getComments.queryKey().slice(0, 1),
        });

        onClose();
      },
      onError: () => {
        setFormState("error");
      },
    }),
  );

  const onSubmit: SubmitHandler<FormData> = async ({ content }) => {
    setFormState("pending");

    updateComment.mutate({
      commentId,
      content,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn("w-full space-y-6", className)}
      >
        <FormItem>
          <FormLabel className="sr-only">Edit comment</FormLabel>
          <FormField
            control={control}
            name="content"
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
                <FormMessage>{errors.content?.message}</FormMessage>
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
