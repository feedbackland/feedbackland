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

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormData = z.infer<typeof formSchema>;

export default function ResetPasswordForm() {
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState("");

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ email }) => {
    await forgetPassword(
      {
        email: email,
        redirectTo: "/reset-password",
      },
      {
        onSuccess: (ctx) => {
          console.log("Password reset email sent", ctx);
          setIsEmailSent(true);
        },
        onError: (error) => {
          console.log("error", error);
          setError("Could not send password reset email");
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

        <Button type="submit" className="w-full">
          Reset Password
        </Button>

        {isEmailSent && (
          <p className="mt-2 text-sm text-green-500">
            A password reset email has been sent.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </form>
    </Form>
  );
}
