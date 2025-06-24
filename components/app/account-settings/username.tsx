"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUpdateUser } from "@/hooks/use-update-user";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const FormSchema = z.object({
  username: z.string().min(1),
});

export function Username({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { session, updateSession } = useAuth();

  const updateUser = useUpdateUser();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      username: "",
    },
  });

  useEffect(() => {
    form.setValue("username", session?.user?.name || "");
  }, [form, session]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    await updateUser.mutateAsync({ name: formData.username });
    updateSession({ username: formData.username });
  }

  return (
    <div className={cn("", className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your username</FormLabel>
                <FormControl>
                  <Input
                    className="w-full max-w-[450px] text-sm"
                    placeholder="Your username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="sm"
            className="mt-3"
            loading={updateUser.isPending}
          >
            Save
          </Button>
        </form>
      </Form>
    </div>
  );
}
