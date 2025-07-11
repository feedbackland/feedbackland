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
import {
  cn,
  getIsSelfHosted,
  getPlatformUrl,
  navigateToSubdomain,
} from "@/lib/utils";
import { useOrg } from "@/hooks/use-org";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { orgSubdomainSchema } from "@/lib/schemas";
import { Label } from "@/components/ui/label";

const FormSchema = z.object({
  orgSubdomain: orgSubdomainSchema,
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
    try {
      const { orgSubdomain: subdomain } = await updateOrg.mutateAsync({
        orgSubdomain: formData.orgSubdomain,
      });
      navigateToSubdomain({ subdomain });
      setIsEditing(false);
    } catch (error) {
      if (error instanceof Error && error?.message?.includes("duplicate key")) {
        form.setError("orgSubdomain", {
          message: "Sorry, this subdomain is already taken",
        });
      } else {
        form.setError("orgSubdomain", {
          message: "An error occured. Please try again.",
        });
      }
    }
  }

  const handleOnCancel = () => {
    setIsEditing(false);
    form.setValue("orgSubdomain", data?.orgSubdomain || "");
    form.clearErrors();
  };

  const isSelfHosted = getIsSelfHosted();

  const url = !isSelfHosted
    ? `${data?.orgSubdomain}.feedbackland.com`
    : getPlatformUrl();

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
                    <FormDescription className="sr-only">
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
                        <div className="text-primary text-sm">{url}</div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isEditing && (
                <div className="mt-3 flex items-center gap-2">
                  <Button type="submit" size="sm" loading={updateOrg.isPending}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleOnCancel}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
        {!isSelfHosted && (
          <div className="-mt-2.5">
            {isEditing ? (
              <Button
                className=""
                size="sm"
                variant="outline"
                onClick={handleOnCancel}
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
        )}
      </div>
    </div>
  );
}
