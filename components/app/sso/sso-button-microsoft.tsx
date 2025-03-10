"use client";

import { Button } from "@/components/ui/button";
import { MicrosoftLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/useAuth";
import { User } from "firebase/auth";

export function SSOButtonMicrosoft({
  onSuccess,
}: {
  onSuccess: (user: User) => void;
}) {
  const { signOnWithMicrosoft } = useAuth();

  const continueWithMicrosoft = async () => {
    try {
      const user = await signOnWithMicrosoft();
      onSuccess(user);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Button
      variant="default"
      className="w-full"
      onClick={continueWithMicrosoft}
    >
      <MicrosoftLogo className="size-5" />
      <span>Continue with Microsoft</span>
    </Button>
  );
}
