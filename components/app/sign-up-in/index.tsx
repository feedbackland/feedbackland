"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignUp } from "@/components/app/sign-up";
import { SignIn } from "@/components/app/sign-in";

type Methods = "sign-up" | "sign-in";

export function SignUpIn({
  initialSelectedMethod,
  includeAnonymous,
  refreshOnSuccess = true,
  context,
  onSelectedMethodChange,
  onSuccess,
}: {
  initialSelectedMethod: Methods;
  includeAnonymous?: boolean;
  refreshOnSuccess?: boolean;
  context?: string;
  onSuccess: ({ userId }: { userId: string }) => void;
  onSelectedMethodChange?: (newSelectedMethod: Methods) => void;
}) {
  const router = useRouter();

  const [selectedMethod, setSelectedMethod] = useState<Methods>(
    initialSelectedMethod,
  );

  useEffect(() => {
    onSelectedMethodChange?.(selectedMethod);
  }, [selectedMethod, onSelectedMethodChange]);

  const handleOnSuccess = ({ userId }: { userId: string }) => {
    if (refreshOnSuccess) router.refresh();
    onSuccess({ userId });
  };

  return selectedMethod === "sign-up" ? (
    <SignUp
      onSuccess={handleOnSuccess}
      onSelectedMethodChange={() => setSelectedMethod("sign-in")}
      includeAnonymous={includeAnonymous}
      context={context}
    />
  ) : (
    <SignIn
      onSuccess={handleOnSuccess}
      onSelectedMethodChange={() => setSelectedMethod("sign-up")}
      includeAnonymous={includeAnonymous}
      context={context}
    />
  );
}
