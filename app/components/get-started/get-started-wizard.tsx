"use client";

import { useState } from "react";
import { SignUpForm } from "../sign-up/sign-up-form";
import { CreateOrgForm } from "./create-org-form";
import { GetStartedCodeblock } from "../get-started-codeblock";
import { useRouter } from "next/navigation";
import { getRootDomain } from "@/app/utils/helpers";

export function GetStartedWizard({ userId }: { userId: string | null }) {
  const [step, setStep] = useState(1);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);
  const router = useRouter();

  if (step === 1 && !userId) {
    return <SignUpForm onSuccess={() => setStep(2)} />;
  }

  if (userId && ((step === 1 && userId) || step === 2)) {
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
          window.location.href = `${window.location.protocol}//${orgSubdomain}.${rootDomain}`;
        }}
      />
    );
  }
}
