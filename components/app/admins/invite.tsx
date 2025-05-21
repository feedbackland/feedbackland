"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function AdminsInvite() {
  const sendInvite = async () => {};

  return (
    <div>
      <Label className="mb-2">Invite admins</Label>
      <div className="border-border flex flex-row items-center gap-4 rounded-md border p-4 shadow-xs">
        <Input
          type="email"
          className="flex-1 text-sm"
          placeholder="Email of the admin you want to invite"
        />
        <Button onClick={sendInvite} size="sm">
          Send Invite
        </Button>
      </div>
    </div>
  );
}
