"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Method, SignUpIn } from "@/components/app/sign-up-in";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "./actions";
import { CreateOrgWrapper } from "./wrapper";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { auth } from "@/lib/firebase/client";

export function CreateOrgClaim({ onSuccess }: { onSuccess: () => void }) {
  const { refreshSession } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<Method>("sign-up");
  const { executeAsync: claimOrg } = useAction(claimOrgAction);

  return (
    <CreateOrgWrapper>
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <CardTitle className="h3 mt-1 mb-3 text-center font-bold">
            Create your account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignUpIn
            selectedMethod={selectedMethod}
            onSelectedMethodChange={(newSelectedMethod) =>
              setSelectedMethod(newSelectedMethod)
            }
            onSuccess={async (session) => {
              const orgId = session?.org?.id;
              // Sign-in just resolved, so currentUser is set. Send its ID token
              // and let the server derive the uid — the claim grants admin, so
              // the client can't be trusted to name the user itself.
              const idToken = await auth.currentUser?.getIdToken();

              if (idToken && orgId) {
                await claimOrg({
                  idToken,
                  orgId,
                });

                await refreshSession();

                onSuccess();
              }
            }}
          />
        </CardContent>
      </Card>
    </CreateOrgWrapper>
  );
}
