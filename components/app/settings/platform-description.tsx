"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { Textarea } from "@/components/ui/textarea";

const FormSchema = z.object({
  platformDescription: z.string().min(1).optional(),
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

  const { setValue } = form;

  useEffect(() => {
    setValue("platformDescription", data?.platformDescription || "");
  }, [setValue, data]);

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    await updateOrg.mutateAsync({
      platformDescription:
        formData?.platformDescription &&
        formData?.platformDescription?.length > 0
          ? formData.platformDescription
          : null,
    });
    setIsEditing(false);
  }

  return (
    <div className={cn("", className)}>
      {isEditing ? (
        <Button
          className="absolute! top-2 right-0"
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(false)}
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
              name="platformDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform description</FormLabel>
                  <FormControl>
                    {isEditing ? (
                      <Textarea
                        autoFocus={true}
                        className="w-full max-w-96"
                        placeholder="Optional: The description of your feedback platform"
                        {...field}
                      />
                    ) : (
                      <div className="text-primary text-sm">
                        {data?.platformDescription || "No description added"}
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
