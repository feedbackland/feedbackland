"use client";

import { useRouter } from "next/navigation";
import { SignUp } from "@/components/app/sign-up";
import { SignIn } from "@/components/app/sign-in";
import { ForgotPasswordForm } from "@/components/app/forgot-password/form";

export type Method = "sign-up" | "sign-in" | "forgot-password";

export function SignUpIn({
  selectedMethod,
  includeAnonymous,
  refreshOnSuccess = true,
  context,
  onSelectedMethodChange,
  onSuccess,
}: {
  selectedMethod: Method;
  includeAnonymous?: boolean;
  refreshOnSuccess?: boolean;
  context?: string;
  onSuccess: ({ userId }: { userId: string }) => void;
  onSelectedMethodChange?: (newSelectedMethod: Method) => void;
}) {
  const router = useRouter();

  const handleOnSuccess = ({ userId }: { userId: string }) => {
    if (refreshOnSuccess) router.refresh();
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
        context={context}
      />
    );
  }

  if (selectedMethod === "sign-up") {
    return (
      <SignUp
        onSuccess={handleOnSuccess}
        onSelectedMethodChange={handleOnSelectedMethodChange}
        includeAnonymous={includeAnonymous}
        context={context}
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
