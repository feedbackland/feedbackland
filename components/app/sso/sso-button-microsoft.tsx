"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { MicrosoftLogo } from "@/components/ui/logos";
import { getCallbackUrl } from "@/lib/client/utils";

export function SSOButtonMicrosoft() {
  const continueWithMicrosoft = async () => {
    await signIn.social({
      provider: "microsoft",
      callbackURL: getCallbackUrl(),
    });
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
