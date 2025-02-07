"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUp } from "@/components/app/sign-up";
import { SignIn } from "@/components/app/sign-in";

type Methods = "sign-up" | "sign-in";

export function SignUpIn({
  defaultSelectedMethod,
  onSuccess,
}: {
  defaultSelectedMethod: Methods;
  onSuccess?: ({ userId }: { userId: string }) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<Methods>(
    defaultSelectedMethod,
  );

  return selectedMethod === "sign-up" ? (
    <SignUp
      onSuccess={({ userId }) => onSuccess?.({ userId })}
      onSwitch={() => setSelectedMethod("sign-in")}
    />
  ) : (
    <SignIn
      onSuccess={({ userId }) => onSuccess?.({ userId })}
      onSwitch={() => setSelectedMethod("sign-up")}
    />
  );
}
