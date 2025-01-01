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

const OrgForm: React.FC = () => {
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
    if (userId) {
      await createOrgAction({
        userId,
        orgName: data.orgName,
        orgSubdomain: data.subdomain,
      });
      router.refresh();
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

      {/* Submit Button */}
      <Button type="submit">Create Organization</Button>
    </form>
  );
};

export default OrgForm;

// "use client";

// import { authClient } from "@/app/utils/client/auth-client";
// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { useRouter } from "next/navigation";
// import { createOrgAction } from "@/app/actions/create-org";

// export function CreateOrgForm({ onSuccess }: { onSuccess?: () => void }) {
//   const [orgName, setOrgName] = useState("");
//   const [orgSubdomain, setOrgSubdomain] = useState("");

//   const router = useRouter();

//   const { data: session } = authClient.useSession();
//   const userId = session?.user?.id;

//   const handleOrgCreation = async () => {
//     if (
//       userId &&
//       orgName &&
//       orgName.length > 0 &&
//       orgSubdomain &&
//       orgSubdomain.length > 0
//     ) {
//       await createOrgAction({
//         userId,
//         orgName,
//         orgSubdomain,
//       });
//       router.refresh();
//       onSuccess?.();
//     }
//   };

//   return (
//     <div className="grid gap-4">
//       <div className="grid gap-2">
//         <Label htmlFor="name">Name</Label>
//         <Input
//           id="name"
//           type="name"
//           placeholder="Organization name"
//           required
//           onChange={(e) => setOrgName(e.target.value)}
//         />
//       </div>
//       <div className="grid gap-2">
//         <Label htmlFor="subdomain">Organization subdomain</Label>
//         <Input
//           id="subdomain"
//           type="text"
//           placeholder="Organization subdomain"
//           required
//           onChange={(e) => setOrgSubdomain(e.target.value)}
//         />
//       </div>
//       <Button type="submit" className="w-full" onClick={handleOrgCreation}>
//         Create organization
//       </Button>
//     </div>
//   );
// }
