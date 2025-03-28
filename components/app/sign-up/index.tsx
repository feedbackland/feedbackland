"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SSOButtonMicrosoft } from "@/components/app/sso/sso-button-microsoft";
import { SSOButtonAnonymous } from "@/components/app/sso/sso-button-anonymous";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Method } from "../sign-up-in";
import { Session } from "@/hooks/use-auth";

export function SignUp({
  onSuccess,
  onSelectedMethodChange,
  includeAnonymous,
}: {
  onSuccess: (session: Session) => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
  includeAnonymous?: boolean;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  const handleOnSuccess = (session: Session) => {
    onSuccess(session);
  };

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <SSOButtonGoogle onSuccess={handleOnSuccess} />
          <SSOButtonMicrosoft onSuccess={handleOnSuccess} />
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign up with Email
          </Button>
          {includeAnonymous && (
            <SSOButtonAnonymous onSuccess={handleOnSuccess} />
          )}
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
