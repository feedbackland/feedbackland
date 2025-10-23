"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpIn } from "@/components/app/sign-up-in";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "./actions";

export function CreateOrgStep2({ onSuccess }: { onSuccess: () => void }) {
  const { executeAsync: claimOrg } = useAction(claimOrgAction);

  return (
    <Card className="w-full max-w-[420px]">
      <CardHeader>
        <CardTitle className="h3 mt-1 mb-3 text-center font-bold">
          Create your account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SignUpIn
          selectedMethod="sign-up"
          onSuccess={async (session) => {
            const userId = session?.user?.id;
            const userEmail = session?.user?.email;
            const orgId = session?.org?.id;

            if (userId && orgId) {
              await claimOrg({
                userId,
                userEmail,
                orgId,
              });
              onSuccess();
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
