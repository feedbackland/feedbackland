"use client";

import { signOut } from "@/app/utils/client/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  return <Button onClick={handleSignOut}>Sign out</Button>;
}
