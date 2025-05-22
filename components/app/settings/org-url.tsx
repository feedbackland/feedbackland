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
import { cn } from "@/lib/utils";
import { useOrg } from "@/hooks/use-org";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

const FormSchema = z.object({
  orgUrl: z.string().optional(),
});

export function OrgUrl({
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
      orgUrl: "",
    },
  });

  useEffect(() => {
    form.setValue("orgUrl", data?.orgUrl || "");
  }, [form, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    await updateOrg.mutateAsync({
      orgUrl:
        formData?.orgUrl && formData?.orgUrl?.length > 0
          ? formData.orgUrl
          : null,
    });
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
                name="orgUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product website</FormLabel>
                    <FormDescription className="">
                      The URL of your product or organization's website
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          autoFocus={true}
                          className="w-full max-w-[450px] text-sm"
                          placeholder="URL of your product or organization's website"
                          {...field}
                        />
                      ) : (
                        <div className="text-primary text-sm">
                          {data?.orgUrl || "No product website added"}
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
                form.setValue("orgUrl", data?.orgUrl || "");
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
