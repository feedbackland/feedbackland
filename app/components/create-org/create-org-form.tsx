"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createOrgAction } from "@/app/components/create-org/create-org-action";
import { useEffect } from "react";
import { slugifySubdomain } from "@/app/utils/helpers";
import { createOrgSchema } from "./create-org-validation";
import { z } from "zod";

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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      userId,
      orgName: "",
      orgSubdomain: "",
    },
  });

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col space-y-1">
        <Label htmlFor="orgName">Company or product name</Label>
        <Input {...register("orgName")} id="orgName" />
        {errors.orgName && (
          <p className="text-sm text-red-500">{errors.orgName.message}</p>
        )}
      </div>
      <div className="flex flex-col space-y-1">
        <Label htmlFor="orgSubdomain">Subdomain</Label>
        <Input {...register("orgSubdomain")} id="orgSubdomain" />
        {errors.orgSubdomain && (
          <p className="text-sm text-red-500">{errors.orgSubdomain.message}</p>
        )}
      </div>
      <Button type="submit">Create Organization</Button>
    </form>
  );
}
