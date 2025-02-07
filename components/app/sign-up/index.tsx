"use client";

import { Button } from "@/components/ui/button";
import { ContinueWithGoogleButton } from "@/components/app/sso/continue-with-google-button";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";

export function SignUp({ onSuccess }: { onSuccess?: () => void }) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <ContinueWithGoogleButton />
          <Button
            variant="default"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign in with Email
          </Button>
        </div>
      ) : (
        <SignUpEmailForm onClose={() => setIsEmailSelected(false)} />
      )}
    </>
  );
}
