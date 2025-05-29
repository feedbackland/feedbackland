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
  orgName: z.string().optional(),
});

export function OrgName({
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
      orgName: "",
    },
  });

  useEffect(() => {
    form.setValue("orgName", data?.orgName || "");
  }, [form, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    await updateOrg.mutateAsync({
      orgName:
        formData?.orgName && formData?.orgName?.length > 0
          ? formData.orgName
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
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product name</FormLabel>
                    <FormDescription className="sr-only">
                      The name of your product or organization
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          autoFocus={true}
                          className="w-full max-w-[450px] text-sm"
                          placeholder="Name of your product or organization"
                          {...field}
                        />
                      ) : (
                        <div className="text-primary text-sm">
                          {data?.orgName || "No name added"}
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
                form.setValue("orgName", data?.orgName || "");
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
