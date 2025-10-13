"use client";

import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { AccountSettings } from "@/components/app/account-settings";
import { PlatformHeaderButtons } from "./buttons";
import { PlatformHeaderTitle } from "./title";
import { PlatformHeaderDescription } from "./description";

export function PlatformHeader() {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const [isAccountSettingsDialogOpen, setIsAccountSettingsDialogOpen] =
    useState(false);

  const closeAccountSettings = () => {
    setIsAccountSettingsDialogOpen(false);
  };

  return (
    <>
      <AccountSettings
        open={isAccountSettingsDialogOpen}
        onClose={closeAccountSettings}
      />

      <SignUpInDialog
        open={isSignUpInDialogOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setIsSignUpInDialogOpen(false)}
      />

      <div className="flex flex-col items-stretch space-y-1 pb-5">
        <div className="flex items-center justify-between">
          <PlatformHeaderTitle />
          <PlatformHeaderButtons />
        </div>

        <PlatformHeaderDescription className="pt-2" />
      </div>
    </>
  );
}
