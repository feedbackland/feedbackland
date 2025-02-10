"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { getCallbackUrl } from "@/lib/client/utils";

export function SSOButtonGoogle() {
  const continueWithGoogle = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: getCallbackUrl(),
    });
  };

  return (
    <Button variant="default" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>Continue with Google</span>
    </Button>
  );
}
