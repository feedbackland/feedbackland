"use client";

import { signIn } from "@/lib/client/auth-client";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email")
    .email("Invalid email address"),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be no more than 128 characters long"),
});

type FormData = z.infer<typeof signInSchema>;

export function SignInEmailForm({
  onSuccess,
  onClose,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
  onClose?: () => void;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    formState: { errors },
    setError,
    clearErrors,
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ email, password }) => {
    clearErrors("root.serverError");

    const { data, error } = await signIn.email({
      email,
      password,
    });

    if (data && !error) {
      onSuccess({ userId: data.user.id });
    }

    if (error) {
      setError("root.serverError", {
        message: error?.message || "An error occured. Please try again.",
      });
    }
  };

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onClose?.()}
        className="mb-4"
      >
        <ArrowLeft className="size-4" />
        Go back
      </Button>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {errors?.root?.serverError && (
            <p className="text-destructive">
              {errors?.root?.serverError.message}
            </p>
          )}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="Email" {...field} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="Password" {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Form>
    </div>
  );
}
