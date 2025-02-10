"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { MicrosoftLogo } from "@/components/ui/logos";

export function SSOButtonMicrosoft({
  method,
  onSuccess,
}: {
  method: "sign-up" | "sign-in";
  onSuccess?: ({ userId }: { userId: string }) => void;
}) {
  const continueWithMicrosoft = async () => {
    const callbackURL = window.location.href;

    const { data, error } = await signIn.social({
      provider: "microsoft",
      callbackURL,
    });

    if (data && "user" in data && !error) {
      onSuccess?.({ userId: data?.user?.id });
    }

    if (error) {
      console.log("error", error);
    }
  };

  return (
    <Button
      variant="default"
      className="w-full"
      onClick={continueWithMicrosoft}
    >
      <MicrosoftLogo className="size-5" />
      <span>
        {method === "sign-in"
          ? "Sign in with Microsoft"
          : "Sign up with Microsoft"}
      </span>
    </Button>
  );
}
