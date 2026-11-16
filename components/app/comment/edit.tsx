"use client";
import { contentMessage } from "@/lib/content-message";

import { hasPendingUpload } from "@/components/ui/minimal-tiptap/upload";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tiptap } from "@/components/ui/tiptap";
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

const formSchema = z.object({
  content: z.string().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function CommentEdit({
  commentId,
  expectedRevision,
  content,
  onClose,
  className,
}: {
  postId: string;
  commentId: string;
  expectedRevision: string;
  content: string;
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
      content,
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = form;
  const uploading = hasPendingUpload(useWatch({ control, name: "content" }));

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
    if (hasPendingUpload(content)) return;
    setFormState("pending");

    updateComment.mutate({
      commentId,
      expectedRevision: draftRevision,
      content,
    });
  };

  return (
    <Form {...form}>
      <form
        inert={updateComment.isPending}
        aria-busy={updateComment.isPending}
        onSubmit={handleSubmit(onSubmit)}
        className={cn("w-full space-y-4", className)}
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
                    disabled={updateComment.isPending}
                    value={field?.value || null}
                    onChange={(value) => field.onChange(value)}
                  />
                </FormControl>
                <FormMessage>{errors.content?.message}</FormMessage>
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
              updateComment.error,
              "Could not save the changes. Try again.",
            )}
          />
        )}
      </form>
    </Form>
  );
}
