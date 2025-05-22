"use client";

import { PlatformDescription } from "@/components/app/settings/platform-description";
import { PlatformTitle } from "@/components/app/settings/platform-title";
import { PlatformUrl } from "@/components/app/settings/platform-url";
import { OrgName } from "./org-name";
import { OrgUrl } from "./org-url";

export default function Settings() {
  const className = "border-border relative w-full border-t-1 border-b-1 py-7";

  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Settings</h2>
      <div className="">
        <OrgName className={className} />
        <OrgUrl className={className} />
        <PlatformTitle className={className} />
        <PlatformDescription className={className} />
        <PlatformUrl className={className} />
      </div>
    </div>
  );
}
