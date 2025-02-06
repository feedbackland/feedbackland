"use client";

import { useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAction } from "next-safe-action/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrgAction } from "./actions";
import { createOrgSchema } from "./validations";
import { slugifySubdomain } from "@/lib/utils";
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

type FormData = z.infer<typeof createOrgSchema>;

export function CreateOrgForm({
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
  const {
    executeAsync: createOrg,
    isPending,
    isIdle,
  } = useAction(createOrgAction);

  const form = useForm<FormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      orgName: "",
      orgSubdomain: "",
    },
  });

  const {
    formState: { errors },
    watch,
    setValue,
    setError,
    clearErrors,
  } = form;

  const organizationName = watch("orgName");

  useEffect(() => {
    setValue("orgSubdomain", slugifySubdomain(organizationName));
    clearErrors("orgSubdomain");
  }, [organizationName, setValue, clearErrors]);

  const onSubmit: SubmitHandler<FormData> = async ({
    orgName,
    orgSubdomain,
  }) => {
    clearErrors("root.serverError");

    const response = await createOrg({
      orgName,
      orgSubdomain,
    });

    if (response?.data?.success && response?.data?.org) {
      const { org } = response.data;
      onSuccess({ orgId: org.id, orgSubdomain: org.subdomain });
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
        <CardTitle className="h3 mb-3 mt-1 text-center font-bold">
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
              name="orgName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company or product name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your company or product name..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgSubdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform url</FormLabel>
                  <FormControl className="">
                    <div className="flex items-center">
                      <Input {...field} />
                      <span className="ml-2 text-sm">.feedbackland.com</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" loading={!isIdle} className="w-full">
              Create platform
            </Button>
          </form>
        </Form>{" "}
      </CardContent>
    </Card>
  );
}
