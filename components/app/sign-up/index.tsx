"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SSOButtonMicrosoft } from "@/components/app/sso/sso-button-microsoft";
import { SSOButtonAnonymous } from "@/components/app/sso/sso-button-anonymous";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";

export function SignUp({
  onSuccess,
  onSwitch,
  includeAnonymous,
  context,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
  onSwitch?: () => void;
  includeAnonymous?: boolean;
  context?: string;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

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
            Sign up with Email
          </Button>
          {includeAnonymous && (
            <SSOButtonAnonymous
              onSuccess={({ userId }) => onSuccess({ userId })}
            />
          )}
          <div className="m-auto mt-4 flex items-center">
            <span className="mr-1 text-sm text-muted-foreground">
              Already have an account?
            </span>
            <Button
              variant="link"
              onClick={() => onSwitch?.()}
              className="p-0 text-sm text-muted-foreground underline hover:text-foreground"
            >
              Sign in
            </Button>
          </div>
        </div>
      ) : (
        <SignUpEmailForm
          onSuccess={({ userId }) => onSuccess({ userId })}
          onClose={() => setIsEmailSelected(false)}
        />
      )}
    </>
  );
}
