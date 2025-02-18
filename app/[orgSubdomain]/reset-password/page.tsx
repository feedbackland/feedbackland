"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { ResetPasswordForm } from "@/components/app/reset-password/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PasswordResetPage() {
  const [token, setToken] = useQueryState("token");
  const [error, setError] = useQueryState("error");
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <div>
      <Card className="m-auto mt-20 w-full max-w-[400px]">
        <CardHeader>
          <CardTitle className="h3 text-center">Reset password</CardTitle>
        </CardHeader>
        <CardContent className="mt-4">
          <ResetPasswordForm
            token={"123"}
            onSuccess={() => {
              setToken(null);
              setError(null);
              setIsSuccess(true);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );

  // if (token && !error && !isSuccess) {
  //   return (
  //     <ResetPasswordForm
  //       token={token}
  //       onSuccess={() => {
  //         setToken(null);
  //         setError(null);
  //         setIsSuccess(true);
  //       }}
  //     />
  //   );
  // }

  // if (isSuccess) {
  //   return <p className="text-green-700">Successfully changed password</p>;
  // }

  // return <p>Reset Password</p>;
}
