"use client";

import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { useAuth } from "@/hooks/use-auth";
import { Session } from "@/hooks/use-auth";

export function SSOButtonGoogle({
  onSuccess,
}: {
  onSuccess: (session: Session) => void;
}) {
  const { signOnWithGoogle } = useAuth();

  const continueWithGoogle = async () => {
    try {
      const session = await signOnWithGoogle();
      onSuccess(session);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Button variant="outline" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>Continue with Google</span>
    </Button>
  );
}
