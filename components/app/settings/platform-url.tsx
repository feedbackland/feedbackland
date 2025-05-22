"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn, reservedSubdomains, subdomainRegex } from "@/lib/utils";
import { useOrg } from "@/hooks/use-org";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

const FormSchema = z.object({
  orgSubdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Please provide a URL")
    .max(63, "URL must be at most 63 characters")
    .regex(
      subdomainRegex,
      "URL is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods.",
    )
    .refine(
      (value) => !reservedSubdomains.includes(value),
      "This URL is reserved for internal use",
    ),
});

export function PlatformUrl({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data },
  } = useOrg();

  const updateOrg = useUpdateOrg();

  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      orgSubdomain: "",
    },
  });

  useEffect(() => {
    form.setValue("orgSubdomain", data?.orgSubdomain || "");
  }, [form, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    await updateOrg.mutateAsync({ orgSubdomain: formData.orgSubdomain });
    setIsEditing(false);
  }

  return (
    <div className={cn("", className)}>
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col items-stretch space-y-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="">
              <FormField
                control={form.control}
                name="orgSubdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform URL</FormLabel>
                    <FormDescription className="">
                      The URL through which your feedback platform is accessible
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <div className="flex w-full max-w-[450px] items-center">
                          <Input
                            autoFocus={true}
                            className="z-10 w-full rounded-r-none text-sm"
                            placeholder="The URL of your feedback platform"
                            {...field}
                          />
                          <div className="border-border text-primary bg-muted flex h-[36px] items-center rounded-l-none rounded-r-md border px-2 text-sm">
                            <span>.feedbackland.com</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-primary text-sm">
                          {`${data?.orgSubdomain}.feedbackland.com`}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isEditing && (
                <Button type="submit" size="sm" className="mt-3">
                  Save
                </Button>
              )}
            </form>
          </Form>
        </div>
        <div className="-mt-2.5">
          {isEditing ? (
            <Button
              className=""
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                form.setValue("orgSubdomain", data?.orgSubdomain || "");
                form.clearErrors();
              }}
            >
              <XIcon className="size-3.5" />
              Cancel
            </Button>
          ) : (
            <Button
              className=""
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <PenIcon className="size-3" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
