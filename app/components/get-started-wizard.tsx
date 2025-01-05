"use client";

import { useState } from "react";
import { SignUpForm } from "./sign-up-form";
import { CreateOrgForm } from "./create-org-form";
import { useSession } from "@/app/utils/client/auth-client";
import { GetStartedCodeblock } from "./get-started-codeblock";
import { useRouter } from "next/navigation";
import { getRootDomain } from "@/app/utils/client/helpers";

export function GetStartedWizard() {
  const [step, setStep] = useState(1);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (!isPending) {
    if (step === 1 && !session) {
      return <SignUpForm onSuccess={() => setStep(2)} />;
    }

    if ((step === 1 && session) || step === 2) {
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
            router.refresh();
            const rootDomain = getRootDomain();
            window.location.href = `${window.location.protocol}//${orgSubdomain}.${rootDomain}`;
          }}
        />
      );
    }
  }
}
