"use client";

import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/useAuth";

export function SSOButtonGoogle({
  onSuccess,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const { signOnWithGoogle } = useAuth();

  const continueWithGoogle = async () => {
    try {
      const { uid } = await signOnWithGoogle();
      onSuccess({ userId: uid });
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
