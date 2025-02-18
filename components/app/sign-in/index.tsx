"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SSOButtonMicrosoft } from "@/components/app/sso/sso-button-microsoft";
import { SSOButtonAnonymous } from "@/components/app/sso/sso-button-anonymous";
import { SignInEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Method } from "../sign-up-in";

export function SignIn({
  onSuccess,
  onSelectedMethodChange,
  includeAnonymous,
  context,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
  includeAnonymous?: boolean;
  context?: string;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  const handleOnSuccess = ({ userId }: { userId: string }) => {
    onSuccess({ userId });
  };

  const handleOnSelectedMethodChange = (newSelectedMethod: Method) => {
    onSelectedMethodChange?.(newSelectedMethod);
  };

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <SSOButtonGoogle context={context} />
          <SSOButtonMicrosoft context={context} />
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign in with Email
          </Button>
          {includeAnonymous && (
            <SSOButtonAnonymous onSuccess={handleOnSuccess} />
          )}
          <div className="m-auto mt-8 flex items-center">
            <span className="mr-1 text-sm text-foreground">
              No account yet?
            </span>
            <Button
              variant="link"
              onClick={() => handleOnSelectedMethodChange("sign-up")}
              className="p-0 underline"
            >
              Sign up
            </Button>
          </div>
        </div>
      ) : (
        <SignInEmailForm
          onSuccess={handleOnSuccess}
          onClose={() => setIsEmailSelected(false)}
          onSelectedMethodChange={handleOnSelectedMethodChange}
        />
      )}
    </>
  );
}
