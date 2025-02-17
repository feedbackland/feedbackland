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
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { forgetPassword } from "@/lib/client/auth-client";
import { Success } from "@/components/ui/success";
import { Error } from "@/components/ui/error";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

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
        redirectTo: "/reset-password",
      },
      {
        onRequest: () => {
          setIsSuccess(false);
          setIsError(false);
          setIsPending(true);
        },
        onResponse: () => {
          setIsPending(false);
        },
        onSuccess: () => {
          reset();
          setIsSuccess(true);
        },
        onError: () => {
          setIsError(true);
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="email" placeholder="Email" {...field} />
              </FormControl>
              <FormMessage>{errors.email?.message}</FormMessage>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" loading={isPending}>
          Reset Password
        </Button>

        {isSuccess && (
          <Success
            title="Password reset email sent"
            description="Please check your email for the password reset link."
          />
        )}

        {isError && (
          <Error
            title="Could not sent password reset email"
            description="An error occured while sending the password reset email. Please try again."
          />
        )}
      </form>
    </Form>
  );
}
