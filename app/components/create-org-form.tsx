"use client";

import { authClient } from "@/app/utils/client/auth-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { createOrgAction } from "@/app/actions/create-org";

export function CreateOrgForm({ onSuccess }: { onSuccess?: () => void }) {
  const [orgName, setOrgName] = useState("");
  const [orgSubdomain, setOrgSubdomain] = useState("");

  const router = useRouter();

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const handleOrgCreation = async () => {
    if (
      userId &&
      orgName &&
      orgName.length > 0 &&
      orgSubdomain &&
      orgSubdomain.length > 0
    ) {
      await createOrgAction({
        userId,
        orgName,
        orgSubdomain,
      });
      router.refresh();
      onSuccess?.();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="name"
          placeholder="Organization name"
          required
          onChange={(e) => setOrgName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="subdomain">Organization subdomain</Label>
        <Input
          id="subdomain"
          type="text"
          placeholder="Organization subdomain"
          required
          onChange={(e) => setOrgSubdomain(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" onClick={handleOrgCreation}>
        Create organization
      </Button>
    </div>
  );
}
