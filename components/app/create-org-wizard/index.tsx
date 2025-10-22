"use client";

import { useState } from "react";
import { CreateOrgStep1 } from "./step1";
import { CreateOrgStep2 } from "./step2";
import { CreateOrgStep3 } from "./step3";

export function CreateOrgWizard() {
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);

  if (step === 1) {
    return (
      <CreateOrgStep1
        onSuccess={({ orgId, orgSubdomain }) => {
          setOrgId(orgId);
          setOrgSubdomain(orgSubdomain);
          sessionStorage.setItem("orgSubdomain", orgSubdomain);
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    return (
      <CreateOrgStep2
        onSuccess={() => {
          sessionStorage.removeItem("orgSubdomain");
          setStep(3);
        }}
      />
    );
  }

  if (step === 3 && orgId && orgSubdomain) {
    return (
      <CreateOrgStep3
        orgId={orgId}
        orgSubdomain={orgSubdomain}
        onSuccess={() => {
          const platformUrl = window.location.href.replace(
            "get-started",
            orgSubdomain,
          );
          window.location.href = platformUrl;
        }}
      />
    );
  }
}
