"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SignOutButton() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  };

  return <Button onClick={handleSignOut}>Sign out</Button>;
}
