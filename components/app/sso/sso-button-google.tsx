"use client";

import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/use-auth";
import { User } from "firebase/auth";

export function SSOButtonGoogle({
  onSuccess,
}: {
  onSuccess: (user: User) => void;
}) {
  const { signOnWithGoogle } = useAuth();

  const continueWithGoogle = async () => {
    try {
      const user = await signOnWithGoogle();
      onSuccess(user);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Button variant="default" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>Continue with Google</span>
    </Button>
  );
}
