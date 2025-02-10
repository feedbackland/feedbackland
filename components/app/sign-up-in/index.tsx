"use client";

import { useState } from "react";
import { SignUp } from "@/components/app/sign-up";
import { SignIn } from "@/components/app/sign-in";

type Methods = "sign-up" | "sign-in";

export function SignUpIn({
  defaultSelectedMethod,
  includeAnonymous,
  onSuccess,
}: {
  defaultSelectedMethod: Methods;
  includeAnonymous?: boolean;
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<Methods>(
    defaultSelectedMethod,
  );

  return selectedMethod === "sign-up" ? (
    <SignUp
      onSuccess={({ userId }) => onSuccess({ userId })}
      onSwitch={() => setSelectedMethod("sign-in")}
      includeAnonymous={includeAnonymous}
    />
  ) : (
    <SignIn
      onSuccess={({ userId }) => onSuccess({ userId })}
      onSwitch={() => setSelectedMethod("sign-up")}
      includeAnonymous={includeAnonymous}
    />
  );
}
