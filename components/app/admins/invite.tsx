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
import { CheckCircle2, Copy } from "lucide-react";
import { useAtom } from "jotai";
import { adminInviteSuccessUrlAtom } from "@/lib/atoms";

const FormSchema = z.object({
  email: z.email(),
});

export function AdminsInvite() {
  const platformUrl = usePlatformUrl();
  const { session } = useAuth();
  const createAdminInvite = useCreateAdminInvite();
  const [successLink, setSuccessLink] = useAtom(adminInviteSuccessUrlAtom);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    try {
      form.clearErrors();

      const result = await createAdminInvite.mutateAsync({
        platformUrl: platformUrl || "",
        email: formData.email,
        invitedBy:
          session?.user?.name ||
          session?.user?.email ||
          "user with unknown name",
      });

      if (result.inviteLink) {
        setSuccessLink(result.inviteLink);
        form.reset();
      }
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
        {successLink ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Invite Link Generated!</p>
            </div>
            <p className="text-muted-foreground text-sm">
              Share this unique link securely with the new administrator. For
              security reasons, this link is bound to the email address
              provided.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={successLink}
                className="w-full font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(successLink);
                  toast.success("Link copied to clipboard", {
                    position: "top-right",
                  });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSuccessLink(null)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
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
                          Generate link
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
