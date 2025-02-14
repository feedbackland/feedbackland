// app/auth/reset-password/page.tsx
"use client";

import { useQueryState } from "nuqs";
import { ResetPasswordForm } from "./reset-password-form";
import { useState } from "react";

export const ResetPasswordListener = () => {
  const [token, setToken] = useQueryState("token");
  const [error, setError] = useQueryState("org");
  const [isSuccess, setIsSuccess] = useState(false);

  if (token && !error && !isSuccess) {
    return (
      <ResetPasswordForm
        token={token}
        onSuccess={() => {
          setToken(null);
          setError(null);
          setIsSuccess(true);
        }}
      />
    );
  }

  if (isSuccess) {
    return <p>Successfully changed password</p>;
  }

  return null;
};
