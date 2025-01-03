"use client";

import { useState } from "react";
import { SignUpForm } from "./sign-up-form";
import { CreateOrgForm } from "./create-org-form";
// import { authClient } from "@/app/utils/client/auth-client";
import { GetStartedCodeblock } from "./get-started-codeblock";
import { useRouter } from "next/navigation";
import {
  getDomainInfo,
  navigateToSubdomain,
} from "@/app//utils/client/helpers";

export function GetStartedWizard() {
  const [step, setStep] = useState(1);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);
  const router = useRouter();
  const domainInfo = getDomainInfo();

  console.log("domainInfo", domainInfo);

  if (step === 1) {
    return <SignUpForm onSuccess={() => setStep(2)} />;
  }

  if (step === 2) {
    return (
      <CreateOrgForm
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
          router?.refresh();
          if (orgSubdomain) {
            navigateToSubdomain(orgSubdomain);
          }
        }}
      />
    );
  }
}
