"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { getSSOCallbackUrl } from "@/lib/client/utils";

export function SSOButtonGoogle({ context }: { context?: string }) {
  const continueWithGoogle = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: getSSOCallbackUrl({ context }),
    });
  };

  return (
    <Button variant="default" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>Continue with Google</span>
    </Button>
  );
}
