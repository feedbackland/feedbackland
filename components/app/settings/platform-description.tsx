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
import { useOrg } from "@/hooks/use-org";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { PenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
  } = useOrg();

  const updateOrg = useUpdateOrg();

  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      platformDescription: "",
    },
  });

  useEffect(() => {
    form.setValue("platformDescription", data?.platformDescription || "");
  }, [form, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    try {
      await updateOrg.mutateAsync({
        platformDescription:
          formData?.platformDescription &&
          formData?.platformDescription?.length > 0
            ? formData.platformDescription
            : null,
      });
      setIsEditing(false);
    } catch {
      form.setError("platformDescription", {
        message: "An error occured. Please try again.",
      });
    }
  }

  const handleOnCancel = () => {
    setIsEditing(false);
    form.setValue("platformDescription", data?.platformDescription || "");
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
                name="platformDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform description</FormLabel>
                    <FormDescription className="sr-only">
                      The description of your feedback platform (optional)
                    </FormDescription>
                    <FormControl>
                      {isEditing ? (
                        <Textarea
                          autoFocus={true}
                          className="w-full max-w-[450px] text-sm"
                          placeholder="Description of your feedback platform"
                          {...field}
                        />
                      ) : (
                        <div
                          className={cn(
                            "text-primary text-sm",
                            !data?.platformDescription &&
                              "text-muted-foreground",
                          )}
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
