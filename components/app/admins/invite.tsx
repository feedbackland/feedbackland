"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateAdminInvite } from "@/hooks/use-create-admin-invite";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const FormSchema = z.object({
  email: z.email(),
});

export function AdminsInvite() {
  const platformUrl = usePlatformUrl();
  const { session } = useAuth();
  const createAdminInvite = useCreateAdminInvite();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    try {
      form.clearErrors();

      await createAdminInvite.mutateAsync({
        platformUrl: platformUrl || "",
        email: formData.email,
        invitedBy:
          session?.user?.name ||
          session?.user?.email ||
          "user with unknown name",
      });

      form.reset();

      toast.success("Invite successfully sent", {
        position: "top-right",
      });
    } catch (error) {
      let message = "Something went wrong. Please try again.";

      if (error instanceof Error) {
        if (error?.message?.toLowerCase()?.includes("invite-email-exists")) {
          message = "This email is already invited";
        }

        if (error?.message?.toLowerCase()?.includes("admin-email-exists")) {
          message = "An admin with this email already exists";
        }
      }

      form.setError("email", {
        message,
      });
    }
  }

  return (
    <div className="mt-6 flex flex-col items-stretch gap-2">
      <Label className="text-muted-foreground">Invite admins</Label>
      <div className="border-border bg-background rounded-md border p-5 shadow-xs">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email to invite</FormLabel>
                  <FormControl>
                    <div className="flex flex-row items-center gap-4">
                      <Input
                        type="email"
                        autoFocus={false}
                        className="w-full max-w-[300px] text-sm"
                        placeholder="Email address"
                        {...field}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-[34px]"
                        loading={createAdminInvite.isPending}
                      >
                        Send invite
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  );
}
