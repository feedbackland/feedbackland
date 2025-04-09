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
  const [formState, setFormState] = useState<{
    type: "idle" | "pending" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

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
    reset,
    formState: { errors },
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ title, description }) => {
    setFormState({ type: "pending" });

    try {
      await sendPasswordResetEmail(auth, email);
      setFormState({ type: "success" });
      reset();
    } catch (error: any) {
      let errorMessage = "An error occurred. Please try again.";

      // Handle common Firebase auth errors
      if (error.code === "auth/user-not-found") {
        errorMessage = "No user found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }

      setFormState({ type: "error", message: errorMessage });
    }
  };

  return (
    <div className="">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormField
              control={control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      autoFocus
                      type="text"
                      placeholder="Title"
                      {...field}
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
                      value={field?.value}
                      onChange={(value) => field.onChange(value)}
                    />
                  </FormControl>
                  <FormMessage>{errors.title?.message}</FormMessage>
                </FormItem>
              )}
            />
          </FormItem>

          <div className="flex items-center space-x-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              className="w-full"
              loading={formState.type === "pending"}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
