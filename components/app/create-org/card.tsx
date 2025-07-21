"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { useAction } from "next-safe-action/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrgAction } from "./actions";
import { createOrgSchema } from "./validations";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { cn } from "@/lib/utils";

type FormData = z.infer<typeof createOrgSchema>;

export function CreateOrgCard({
  onSuccess,
}: {
  onSuccess: ({
    orgId,
    orgSubdomain,
  }: {
    orgId: string;
    orgSubdomain: string;
  }) => void;
}) {
  const isSelfHosted = useIsSelfHosted();

  const { executeAsync: createOrg, isPending } = useAction(createOrgAction);

  const form = useForm<FormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      orgSubdomain: "",
    },
  });

  const {
    formState: { errors },
    setError,
    clearErrors,
  } = form;

  const onSubmit: SubmitHandler<FormData> = async ({ orgSubdomain }) => {
    clearErrors("root.serverError");

    const response = await createOrg({
      orgSubdomain,
    });

    if (response?.data?.success && response?.data?.org) {
      const { org } = response.data;
      onSuccess({ orgId: org.id, orgSubdomain: org.orgSubdomain });
    } else if (response?.data?.message === "duplicate subdomain") {
      setError("orgSubdomain", {
        message: "Sorry, this subdomain is already taken",
      });
    } else {
      setError("root.serverError", {
        message: "An error occured. Please try again.",
      });
    }
  };

  return (
    <Card className="w-full max-w-[400px]">
      <CardHeader>
        <CardTitle className="h3 mt-1 mb-3 text-center font-bold">
          Create your platform
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {errors?.root?.serverError && (
              <p className="text-destructive">
                {errors?.root?.serverError.message}
              </p>
            )}
            <FormField
              control={form.control}
              name="orgSubdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform url</FormLabel>
                  <FormControl>
                    <div className="tems-center flex">
                      {isSelfHosted && process?.env?.NEXT_PUBLIC_VERCEL_URL && (
                        <div className="border-border text-primary bg-muted flex h-[36px] items-center rounded-l-md rounded-r-none border px-3 text-sm">
                          <span>{`${process.env.NEXT_PUBLIC_VERCEL_URL}/`}</span>
                        </div>
                      )}
                      <Input
                        autoFocus={true}
                        className={cn("z-10 w-full text-sm", {
                          "rounded-r-none": !isSelfHosted,
                          "rounded-l-none": isSelfHosted,
                        })}
                        placeholder="subdomain"
                        {...field}
                      />
                      {!isSelfHosted && (
                        <div className="border-border text-primary bg-muted flex h-[36px] items-center rounded-l-none rounded-r-md border px-3 text-sm">
                          <span>.feedbackland.com</span>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" loading={isPending} className="w-full">
              Create platform
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
