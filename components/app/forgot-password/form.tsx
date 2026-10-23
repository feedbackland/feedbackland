"use client";

import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { sendPasswordResetEmail } from "firebase/auth";
import { Success } from "@/components/ui/success";
import { Error } from "@/components/ui/error";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  email: z.email(),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm({ onGoBack }: { onGoBack: () => void }) {
  const { authAvailable } = useAuth();
  const [formState, setFormState] = useState<{
    type: "idle" | "pending" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

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
    if (!authAvailable) return;
    setFormState({ type: "pending" });

    try {
      await sendPasswordResetEmail(auth, email);
      setFormState({ type: "success" });
      reset();
    } catch (error: unknown) {
      const code =
        error instanceof Object && "code" in error ? error.code : null;
      let errorMessage = "An error occurred. Please try again.";

      // Handle common Firebase auth errors
      if (code === "auth/user-not-found") {
        errorMessage = "No user found with this email address.";
      } else if (code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }

      setFormState({ type: "error", message: errorMessage });
    }
  };

  if (!authAvailable)
    return <p role="status">Sign-in is available in a later milestone.</p>;

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
                      autoFocus={true}
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
            loading={formState.type === "pending"}
          >
            Send reset link
          </Button>
        </form>
      </Form>

      {formState.type === "success" && (
        <Success
          title="Password reset email sent"
          description="Please check your email for the password reset link."
          className="mt-4"
        />
      )}

      {formState.type === "error" && formState.message && (
        <Error
          title="Could not sent password reset email"
          description={formState.message}
          className="mt-4"
        />
      )}
    </div>
  );
}
