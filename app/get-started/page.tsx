"use client";

import { CreateOrgWizard } from "@/components/app/create-org-wizard";
import { FeedbacklandLogoFull } from "@/components/ui/logos";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function GetStartedPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
  }, []);

  return (
    <div className="bg-muted dark:bg-background m-auto flex min-h-dvh w-dvw flex-col items-center pt-14">
      <FeedbacklandLogoFull className="fill-primary-foreground! mb-8 w-[165px]" />
      <CreateOrgWizard />
    </div>
  );
}
