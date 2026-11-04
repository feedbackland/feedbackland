"use client";

import { Button } from "@/components/ui/button";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Method } from "../sign-up-in";
import { Session } from "@/hooks/use-auth";
import { SocialSignIn } from "../social-sign-in";

export function SignUp({
  onSuccess,
  onSelectedMethodChange,
}: {
  onSuccess: (session: Session) => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  const handleOnSuccess = (session: Session) => {
    onSuccess(session);
  };

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <SocialSignIn onSuccess={handleOnSuccess} />
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign up with Email
          </Button>
          <div className="m-auto mt-8 flex items-center">
            <span className="text-foreground mr-1 text-sm">
              Already have an account?
            </span>
            <Button
              variant="link"
              onClick={() => onSelectedMethodChange?.("sign-in")}
              className="p-0 underline"
            >
              Sign in
            </Button>
          </div>
        </div>
      ) : (
        <SignUpEmailForm
          onSuccess={handleOnSuccess}
          onClose={() => setIsEmailSelected(false)}
        />
      )}
    </>
  );
}
