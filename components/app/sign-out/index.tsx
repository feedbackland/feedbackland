"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getQueryClient } from "@/providers/trpc-client";

export function SignOutButton() {
  const queryClient = getQueryClient();

  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    queryClient.invalidateQueries();
  };

  return <Button onClick={handleSignOut}>Sign out</Button>;
}
