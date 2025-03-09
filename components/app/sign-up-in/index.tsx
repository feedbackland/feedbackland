"use client";

import { SignUp } from "@/components/app/sign-up";
import { SignIn } from "@/components/app/sign-in";
import { ForgotPasswordForm } from "@/components/app/forgot-password/form";
import { getQueryClient } from "@/providers/trpc-client";

export type Method = "sign-up" | "sign-in" | "forgot-password";

export function SignUpIn({
  selectedMethod,
  includeAnonymous,
  onSelectedMethodChange,
  onSuccess,
}: {
  selectedMethod: Method;
  includeAnonymous?: boolean;
  onSuccess: ({ userId }: { userId: string }) => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
}) {
  const queryClient = getQueryClient();

  const handleOnSuccess = async ({ userId }: { userId: string }) => {
    queryClient.invalidateQueries();
    onSuccess({ userId });
  };

  const handleOnSelectedMethodChange = (newSelectedMethod: Method) => {
    onSelectedMethodChange?.(newSelectedMethod);
  };

  if (selectedMethod === "sign-in") {
    return (
      <SignIn
        onSuccess={handleOnSuccess}
        onSelectedMethodChange={handleOnSelectedMethodChange}
        includeAnonymous={includeAnonymous}
      />
    );
  }

  if (selectedMethod === "sign-up") {
    return (
      <SignUp
        onSuccess={handleOnSuccess}
        onSelectedMethodChange={handleOnSelectedMethodChange}
        includeAnonymous={includeAnonymous}
      />
    );
  }

  if (selectedMethod === "forgot-password") {
    return (
      <ForgotPasswordForm
        onGoBack={() => handleOnSelectedMethodChange("sign-in")}
      />
    );
  }
}
