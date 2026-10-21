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
import { cn } from "@/lib/utils";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { Textarea } from "@/components/ui/textarea";

const FormSchema = z.object({
  platformDescription: z.string().optional(),
});

export function PlatformDescription({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data },
  } = useAdminSettings();

  const updateSettings = useUpdateSettings();

  const [isEditing, setIsEditing] = useState(false);
  const draftBase = useRef<{ value: string; revision: string } | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      platformDescription: "",
    },
  });
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!data) return;
    const value = data.platformDescription ?? "";
    if (!isEditing || !isDirty) {
      form.reset({ platformDescription: value });
      draftBase.current = { value, revision: data.revision };
    } else if (draftBase.current?.value === value) {
      draftBase.current = { value, revision: data.revision };
    }
  }, [form, data, isEditing, isDirty]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    try {
      if (!data || !draftBase.current) throw new Error("Settings unavailable");
      await updateSettings.mutateAsync({
        expectedRevision: draftBase.current.revision,
        platformDescription:
          formData?.platformDescription &&
          formData?.platformDescription?.length > 0
            ? formData.platformDescription
            : null,
      });
      setIsEditing(false);
    } catch (error) {
      form.setError("platformDescription", {
        message:
          error instanceof TRPCClientError && error.data?.code === "CONFLICT"
            ? "This setting changed elsewhere. Cancel and reopen to load the current value."
            : "An error occured. Please try again.",
      });
    }
  }

  const handleOnCancel = () => {
    setIsEditing(false);
    form.reset({ platformDescription: data?.platformDescription || "" });
  };

  return (
    <div className={cn("", className)}>
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col items-stretch space-y-3">
          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              className=""
            >
              <FormField
                control={form.control}
                name="platformDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform description</FormLabel>
                    <FormDescription className="">
                      Description of your feedback platform, displayed at the
                      top of the page underneath the title
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <Textarea
                          disabled={updateSettings.isPending}
                          autoFocus={true}
                          className="w-full max-w-[450px] text-sm"
                          placeholder="Description of your feedback platform"
                          {...field}
                        />
                      ) : (
                        <div
                          className={cn("text-primary text-sm", {
                            "text-muted-foreground": !data?.platformDescription,
                          })}
                        >
                          {data?.platformDescription || "No description added"}
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
                    type="button"
                    disabled={updateSettings.isPending}
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
              disabled={updateSettings.isPending}
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
              disabled={!data}
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
