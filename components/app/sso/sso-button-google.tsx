"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/logos";
import { getSSOCallbackUrl } from "@/lib/client/utils";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function SSOButtonGoogle({ context }: { context?: string }) {
  const provider = new GoogleAuthProvider();

  const continueWithGoogle = async () => {
    // await signIn.social({
    //   provider: "google",
    //   callbackURL: getSSOCallbackUrl({ context }),
    // });

    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("success", result);
      })
      .catch((error) => {
        console.log("error");
      });
  };

  return (
    <Button variant="default" className="w-full" onClick={continueWithGoogle}>
      <GoogleLogo className="size-5" />
      <span>Continue with Google</span>
    </Button>
  );
}
