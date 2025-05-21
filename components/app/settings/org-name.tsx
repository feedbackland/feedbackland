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
  orgName: z.string().min(1),
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
    await updateOrg.mutateAsync({ orgName: formData.orgName });
    setIsEditing(false);
  }

  return (
    <div className={cn("", className)}>
      {isEditing ? (
        <Button
          className="absolute! top-2 right-0"
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
          className="absolute! top-2 right-0"
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(true)}
        >
          <PenIcon className="size-3" />
          Edit
        </Button>
      )}

      <div className="flex flex-col items-stretch space-y-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="">
            <FormField
              control={form.control}
              name="orgName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization or product name</FormLabel>
                  <FormDescription>
                    The name of your organization or product.
                  </FormDescription>
                  <FormControl>
                    {isEditing ? (
                      <Input
                        autoFocus={true}
                        className="w-full max-w-96"
                        placeholder="The name of your organization or product"
                        {...field}
                      />
                    ) : (
                      <div className="text-primary text-sm">
                        {data?.orgName}
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
    </div>
  );
}
