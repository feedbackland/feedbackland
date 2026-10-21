"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
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
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

const FormSchema = z.object({
  platformTitle: z.string().min(1),
});

export function PlatformTitle({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data },
  } = useAdminSettings();

  const updateSettings = useUpdateSettings();

  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      platformTitle: "",
    },
  });

  useEffect(() => {
    form.setValue("platformTitle", data?.platformTitle || "");
  }, [form, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    try {
      if (!data) throw new Error("Settings unavailable");
      await updateSettings.mutateAsync({
        expectedRevision: data.revision,
        platformTitle: formData.platformTitle,
      });
      setIsEditing(false);
    } catch {
      form.setError("platformTitle", {
        message: "An error occured. Please try again.",
      });
    }
  }

  const handleOnCancel = () => {
    setIsEditing(false);
    form.setValue("platformTitle", data?.platformTitle || "");
    form.clearErrors();
  };

  return (
    <div className={cn("", className)}>
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col items-stretch space-y-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="">
              <FormField
                control={form.control}
                name="platformTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform title</FormLabel>
                    <FormDescription className="">
                      The title of your feedback platform, displayed at the top
                      of the page
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          autoFocus={true}
                          className="w-full max-w-[450px] text-sm"
                          placeholder="Title of your feedback platform"
                          {...field}
                        />
                      ) : (
                        <div className="text-primary text-sm">
                          {data?.platformTitle}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isEditing && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    loading={updateSettings.isPending}
                  >
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
      </div>
    </div>
  );
}
