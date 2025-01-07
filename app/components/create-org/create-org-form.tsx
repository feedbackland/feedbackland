"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  createOrgAction,
  checkOrgNameAvailability,
  checkOrgSubdomainAvailability,
} from "@/app/components/create-org/create-org-actions";
import { useEffect } from "react";
import { slugifySubdomain } from "@/app/utils/helpers";
import { createOrgSchema } from "./create-org-validation";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type FormData = z.infer<typeof createOrgSchema>;

export function CreateOrgForm({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess?: ({
    orgName,
    orgSubdomain,
  }: {
    orgName: string;
    orgSubdomain: string;
  }) => void;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      userId,
      orgName: "",
      orgSubdomain: "",
    },
  });

  const { watch, setValue, setError, clearErrors } = form;

  const organizationName = watch("orgName");

  const router = useRouter();

  useEffect(() => {
    setValue("orgSubdomain", slugifySubdomain(organizationName));
  }, [organizationName, setValue]);

  const onSubmit: SubmitHandler<FormData> = async ({
    userId,
    orgName,
    orgSubdomain,
  }) => {
    try {
      await createOrgAction({
        userId,
        orgName,
        orgSubdomain,
      });
      router.refresh();
      onSuccess?.({ orgName, orgSubdomain });
    } catch (error) {
      console.log(error);
    }
  };

  const handleBlur = async (
    field: "orgName" | "orgSubdomain",
    value: string
  ) => {
    const result =
      field === "orgName"
        ? await checkOrgNameAvailability({ orgName: value })
        : await checkOrgSubdomainAvailability({ orgSubdomain: value });

    if (result?.data?.isAvailable === false) {
      setError(field, { type: "manual", message: result.data.message });
    } else {
      clearErrors(field);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="orgName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company or product name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Company or product name"
                  {...field}
                  onBlur={(e) => handleBlur("orgName", e.target.value)}
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
              <FormLabel>Subdomain</FormLabel>
              <FormControl>
                <Input
                  placeholder="Subdomain"
                  {...field}
                  onBlur={(e) => handleBlur("orgSubdomain", e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
