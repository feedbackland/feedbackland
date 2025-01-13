"use client";

import { useState } from "react";
import { SignUpForm } from "@/app/_components/sign-up/sign-up-form";
import { CreateOrgForm } from "./create-org-form";
import { GetStartedCodeblock } from "./get-started-codeblock";
import { useRouter } from "next/navigation";
import { getRootDomain } from "@/app/utils/helpers";

export function GetStartedWizard({
  userId,
}: {
  userId: string | null | undefined;
}) {
  const [step, setStep] = useState(1);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);
  const router = useRouter();

  if (!userId) {
    return <SignUpForm onSuccess={() => setStep(2)} />;
  }

  if (userId && (step === 1 || step === 2)) {
    return (
      <CreateOrgForm
        userId={userId}
        onSuccess={({ orgSubdomain }) => {
          setOrgSubdomain(orgSubdomain);
          setStep(3);
        }}
      />
    );
  }

  if (step === 3) {
    return (
      <GetStartedCodeblock
        onSuccess={() => {
          router.refresh();
          const rootDomain = getRootDomain({ host: window.location.host });

          if (rootDomain) {
            window.location.href = `${window.location.protocol}//${orgSubdomain}.${rootDomain}`;
          }
        }}
      />
    );
  }
}
