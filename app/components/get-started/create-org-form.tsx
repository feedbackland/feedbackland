"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  createOrgAction,
  checkOrgSubdomainAvailability,
} from "@/app/components/get-started/create-org-actions";
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

  const { watch, setValue, setError, getValues, clearErrors } = form;

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
      const isAvailable = await checkSubdomainAvailability();

      if (isAvailable) {
        await createOrgAction({
          userId,
          orgName,
          orgSubdomain,
        });
        router.refresh();
        onSuccess?.({ orgName, orgSubdomain });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const checkSubdomainAvailability = async () => {
    const orgSubdomain = getValues("orgSubdomain");
    const result = await checkOrgSubdomainAvailability({ orgSubdomain });
    const isAvailable = result?.data?.isAvailable;

    if (isAvailable === false) {
      setError("orgSubdomain", {
        message: "Sorry, this subdomain is already taken",
      });
    } else {
      clearErrors("orgSubdomain");
    }

    return isAvailable;
  };

  const handleOnBlur = async () => {
    checkSubdomainAvailability();
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
                  onBlur={handleOnBlur}
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
                  onBlur={handleOnBlur}
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
