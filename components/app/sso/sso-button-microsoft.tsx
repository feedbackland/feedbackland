"use client";

import { Button } from "@/components/ui/button";
import { MicrosoftLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/use-auth";
import { Session } from "@/hooks/use-auth";

export function SSOButtonMicrosoft({
  onSuccess,
}: {
  onSuccess: (session: Session) => void;
}) {
  const { signOnWithMicrosoft } = useAuth();

  const continueWithMicrosoft = async () => {
    try {
      const session = await signOnWithMicrosoft();
      onSuccess(session);
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
