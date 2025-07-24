"use client";

import { z } from "zod/v4";
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
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Session } from "@/hooks/use-auth";

export const signUpSchema = z.object({
  name: z.string().min(1, "please provide a name"),
  email: z.email()
    .min(1, "Please type your email address"),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be no more than 128 characters long"),
});

type FormData = z.infer<typeof signUpSchema>;

export function SignUpEmailForm({
  onSuccess,
  onClose,
}: {
  onSuccess: (session: Session) => void;
  onClose?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const { signUpWithEmail } = useAuth();

  const {
    formState: { errors },
    setError,
    clearErrors,
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({
    name,
    email,
    password,
  }) => {
    clearErrors("root.serverError");

    setIsPending(true);

    try {
      const session = await signUpWithEmail({
        name,
        email,
        password,
      });
      onSuccess(session);
    } catch (error: any) {
      let message = "An error occured. Please try again";

      if (error?.message?.includes("email-already-in-use")) {
        message = "This email is already in use. Please sign in instead.";
      }

      setError("root.serverError", {
        message,
      });
    } finally {
      setIsPending(false);
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {errors?.root?.serverError && (
            <p className="text-destructive">
              {errors?.root?.serverError.message}
            </p>
          )}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    placeholder="Username"
                    {...field}
                    type="text"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <Button type="submit" className="w-full" loading={isPending}>
            Sign up
          </Button>
        </form>
      </Form>
    </div>
  );
}
