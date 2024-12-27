"use client";

import { authClient } from "@/app/utils/client/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  if (session) {
    return <Button onClick={handleSignOut}>Sign out</Button>;
  }

  return null;
}
