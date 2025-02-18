"use client";

import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormLabel,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { forgetPassword } from "@/lib/client/auth-client";
import { Success } from "@/components/ui/success";
import { Error } from "@/components/ui/error";
import { ArrowLeft } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm({ onGoBack }: { onGoBack: () => void }) {
  const [formState, setFormState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ email }) => {
    await forgetPassword(
      {
        email: email,
        // redirectTo: "/reset-password",
      },
      {
        onRequest: () => {
          setFormState("pending");
        },
        onSuccess: () => {
          reset();
          setFormState("success");
        },
        onError: () => {
          setFormState("error");
        },
      },
    );
  };

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={onGoBack} className="mb-4">
        <ArrowLeft className="size-4" />
        Go back
      </Button>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormField
              control={control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      autoFocus
                      type="email"
                      placeholder="Email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage>{errors.email?.message}</FormMessage>
                </FormItem>
              )}
            />
          </FormItem>

          <Button
            type="submit"
            className="w-full"
            loading={formState === "pending"}
          >
            Send reset link
          </Button>

          {formState === "success" && (
            <Success
              title="Password reset email sent"
              description="Please check your email for the password reset link."
            />
          )}

          {formState === "error" && (
            <Error
              title="Could not sent password reset email"
              description="An error occured while trying to send the password reset email. Please try again."
            />
          )}
        </form>
      </Form>
    </div>
  );
}
