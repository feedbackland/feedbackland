"use client";

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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
// import { resetPassword } from "@/lib/client/auth-client";
import { useState } from "react";
import { Success } from "@/components/ui/success";
import { Error } from "@/components/ui/error";

const formSchema = z
  .object({
    password: z
      .string()
      .trim()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must be no more than 128 characters long"),
    confirmPassword: z
      .string()
      .trim()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must be no more than 128 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export function ResetPasswordForm({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess?: () => void;
}) {
  const [formState, setFormState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ password }) => {
    // await resetPassword(
    //   {
    //     newPassword: password,
    //     token,
    //   },
    //   {
    //     onRequest: () => {
    //       setFormState("pending");
    //     },
    //     onSuccess: () => {
    //       reset();
    //       setFormState("success");
    //       onSuccess?.();
    //     },
    //     onError: () => {
    //       setFormState("error");
    //     },
    //   },
    // );
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input
                  autoFocus
                  type="password"
                  placeholder="New password"
                  {...field}
                />
              </FormControl>
              <FormMessage>{errors.password?.message}</FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  {...field}
                />
              </FormControl>
              <FormMessage>{errors.confirmPassword?.message}</FormMessage>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          loading={formState === "pending"}
        >
          Change password
        </Button>

        {formState === "success" && (
          <Success
            title="Password successfully changed"
            description="Sign in to your account to continue."
          />
        )}

        {formState === "error" && (
          <Error
            title="Could not change password"
            description="An error occured while trying to change your password. Please try again."
          />
        )}
      </form>
    </Form>
  );
}
