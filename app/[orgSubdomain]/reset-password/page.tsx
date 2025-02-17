"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { ResetPasswordForm } from "@/components/app/reset-password/reset-password-form";

export default function PasswordResetPage() {
  const [token, setToken] = useQueryState("token");
  const [error, setError] = useQueryState("error");
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
    return <p className="text-green-700">Successfully changed password</p>;
  }

  return <p>Reset Password</p>;
}
