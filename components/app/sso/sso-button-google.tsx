"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";

export function SSOButtonGoogle({
  method,
  onSuccess,
}: {
  method: "sign-up" | "sign-in";
  onSuccess?: ({ userId }: { userId: string }) => void;
}) {
  const continueWithGoogle = async () => {
    const callbackURL = window.location.href;

    const { data, error } = await signIn.social({
      provider: "google",
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
    <Button variant="default" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>
        {method === "sign-in" ? "Sign in with Google" : "Sign up with Google"}
      </span>
    </Button>
  );
}
