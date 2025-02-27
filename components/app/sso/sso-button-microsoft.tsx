"use client";

import { Button } from "@/components/ui/button";
import { MicrosoftLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/useAuth";

export function SSOButtonMicrosoft({
  onSuccess,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const { signOnWithMicrosoft } = useAuth();

  const continueWithMicrosoft = async () => {
    try {
      const { uid } = await signOnWithMicrosoft();
      onSuccess({ userId: uid });
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
