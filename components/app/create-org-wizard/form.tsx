"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { useAction } from "next-safe-action/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrgAction } from "./actions";
import { createOrgSchema } from "./validations";
import { z } from "zod/v4";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { cn, convertToSubdomain } from "@/lib/utils";
import { useVercelUrl } from "@/hooks/use-vercel-url";
import { useEffect } from "react";
import { CreateOrgWrapper } from "./wrapper";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

type FormData = z.infer<typeof createOrgSchema>;

export function CreateOrgForm() {
  const router = useRouter();
  const isSelfHosted = useIsSelfHosted();
  const vercelUrl = useVercelUrl();
  const { signOut } = useAuth();

  const { executeAsync: createOrg, isPending } = useAction(createOrgAction);

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
    signOut();
  }, []);

  useEffect(() => {
    setValue("orgSubdomain", convertToSubdomain(organizationName));
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

    if (response?.data?.org?.orgSubdomain) {
      const platformUrl = window.location.href.replace(
        "get-started",
        response.data.org.orgSubdomain,
      );
      router.push(`${platformUrl}/claim`);
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
    <CreateOrgWrapper>
      <Card className="w-full max-w-[420px]">
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
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>The name of your product</FormLabel>
                    <FormControl>
                      <Input
                        autoFocus={true}
                        placeholder="Product name"
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
                    <FormLabel>Platform URL</FormLabel>
                    <FormControl>
                      <div className="tems-center flex">
                        {isSelfHosted && vercelUrl && (
                          <div className="border-border text-primary bg-muted flex h-[36px] items-center rounded-l-md rounded-r-none border px-3 text-sm">
                            <span>{vercelUrl}/</span>
                          </div>
                        )}
                        <Input
                          autoFocus={false}
                          className={cn("z-10 w-full text-sm", {
                            "rounded-r-none": !isSelfHosted,
                            "rounded-l-none": isSelfHosted,
                          })}
                          placeholder="subdomain"
                          {...field}
                        />
                        {!isSelfHosted && (
                          <div className="border-border text-primary bg-muted flex h-[36px] items-center rounded-l-none rounded-r-md border px-3 text-sm shadow-sm">
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
    </CreateOrgWrapper>
  );
}
