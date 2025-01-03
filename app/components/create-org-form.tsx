"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { authClient } from "@/app/utils/client/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createOrgAction } from "@/app/actions/create-org";

type OrgFormInputs = {
  orgName: string;
  subdomain: string;
};

export function CreateOrgForm({
  onSuccess,
}: {
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

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const onSubmit: SubmitHandler<OrgFormInputs> = async (data) => {
    console.log("userId:", userId);
    console.log("Form submitted:", data);
    const { orgName, subdomain: orgSubdomain } = data;
    if (userId) {
      await createOrgAction({
        userId,
        orgName,
        orgSubdomain,
      });
      router.refresh();
      onSuccess?.({ orgName, orgSubdomain });
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
        <Label htmlFor="subdomain">Subdomain</Label>
        <Input
          id="subdomain"
          placeholder="Enter subdomain"
          {...register("subdomain", {
            required: "Subdomain is required",
            pattern: {
              value: /^[a-z0-9]+(-[a-z0-9]+)*$/,
              message: "Subdomain must be alphanumeric and can include hyphens",
            },
          })}
        />
        {errors.subdomain && (
          <p className="text-sm text-red-500">{errors.subdomain.message}</p>
        )}
      </div>

      <Button type="submit">Create Organization</Button>
    </form>
  );
}
