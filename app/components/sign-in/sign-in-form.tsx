"use client";

import { signIn } from "@/app/utils/client/auth-client";
import { useRouter } from "next/navigation";
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

export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
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

  const router = useRouter();

  const signInWithGoogle = async () => {
    await signIn.social({
      provider: "google",
      // callbackURL: "/",
      fetchOptions: {
        onRequest: (ctx) => {
          console.log("onRequest", ctx);
        },
        onResponse: (ctx) => {
          console.log("onResponse", ctx);
        },
        onSuccess: (ctx) => {
          console.log("onSuccess", ctx);
          // router.refresh();
          // onSuccess?.();
        },
      },
    });
  };

  const onSubmit: SubmitHandler<FormData> = async ({ email, password }) => {
    clearErrors("root.serverError");

    const { data, error } = await signIn.email({
      email,
      password,
    });

    if (data && !error) {
      router.refresh();
      onSuccess?.();
    }

    if (error) {
      setError("root.serverError", {
        message: error?.message || "An error occured. Please try again.",
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          Login with Google
        </Button>
      </div>
      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {errors?.root?.serverError && (
            <p className="text-red-500">{errors?.root?.serverError.message}</p>
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
          <Button type="submit">Sign in</Button>
        </form>
      </Form>
    </>
  );
}
