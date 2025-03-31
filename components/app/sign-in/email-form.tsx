"use client";

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
import { useState } from "react";
import { Method } from "../sign-up-in";
import { useAuth } from "@/hooks/use-auth";
import { Session } from "@/hooks/use-auth";

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
  onSelectedMethodChange,
}: {
  onSuccess: (session: Session) => void;
  onClose?: () => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const { signInWithEmail } = useAuth();

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

    setIsPending(true);

    try {
      const session = await signInWithEmail({
        email,
        password,
      });
      onSuccess(session);
    } catch (error: any) {
      setError("root.serverError", {
        message: error?.message || "An error occured. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleOnSelectedMethodChange = (newSelectedMethod: Method) => {
    onSelectedMethodChange?.(newSelectedMethod);
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
                  <Input
                    autoFocus
                    placeholder="Email"
                    {...field}
                    type="email"
                  />
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
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground p-0 underline"
                    onClick={() =>
                      handleOnSelectedMethodChange("forgot-password")
                    }
                  >
                    Forgot password?
                  </Button>
                </div>
                <FormControl>
                  <Input placeholder="Password" {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" loading={isPending}>
            Sign in
          </Button>
        </form>
      </Form>
    </div>
  );
}
