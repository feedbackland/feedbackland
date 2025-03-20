"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SignOutButton() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return <Button onClick={handleSignOut}>Sign out</Button>;
}
