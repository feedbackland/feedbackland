"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createOrgAction } from "@/app/actions/create-org";

type OrgFormInputs = {
  orgName: string;
  orgSubdomain: string;
};

export function CreateOrgForm({
  userId,
  onSuccess,
}: {
  userId: string | null;
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
    formState: { errors },
  } = useForm<OrgFormInputs>();

  const router = useRouter();

  const onSubmit: SubmitHandler<OrgFormInputs> = async (data) => {
    const { orgName, orgSubdomain } = data;

    if (userId && orgName && orgSubdomain) {
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
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Organization Name Field */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="orgName">Organization Name</Label>
        <Input
          id="orgName"
          placeholder="Enter organization name"
          {...register("orgName", {
            required: "Organization name is required",
          })}
        />
        {errors.orgName && (
          <p className="text-sm text-red-500">{errors.orgName.message}</p>
        )}
      </div>

      {/* Subdomain Field */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="orgSubdomain">Subdomain</Label>
        <Input
          id="orgSubdomain"
          placeholder="Enter subdomain"
          {...register("orgSubdomain", {
            required: "Subdomain is required",
            pattern: {
              value: /^[a-z0-9]+(-[a-z0-9]+)*$/,
              message: "Subdomain must be alphanumeric and can include hyphens",
            },
          })}
        />
        {errors.orgSubdomain && (
          <p className="text-sm text-red-500">{errors.orgSubdomain.message}</p>
        )}
      </div>

      <Button type="submit">Create Organization</Button>
    </form>
  );
}
