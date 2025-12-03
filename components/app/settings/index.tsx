"use client";

import { PlatformDescription } from "@/components/app/settings/platform-description";
import { PlatformTitle } from "@/components/app/settings/platform-title";
import { PlatformUrl } from "@/components/app/settings/platform-url";
import { Logo } from "@/components/app/settings/logo";
import { OrgName } from "@/components/app/settings/org-name";
import { OrgUrl } from "@/components/app/settings/org-url";

export default function Settings() {
  const className = "border-border relative w-full border-b py-5 px-4";

  return (
    <div className="">
      <h2 className="h5 mb-6">Settings</h2>
      <div className="bg-background border-border rounded-lg border shadow-xs">
        <Logo className={className} />
        <OrgName className={className} />
        <OrgUrl className={className} />
        <PlatformTitle className={className} />
        <PlatformDescription className={className} />
        <PlatformUrl className={`${className} border-b-0`} />
      </div>
    </div>
  );
}
