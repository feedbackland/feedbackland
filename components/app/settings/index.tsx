"use client";

import { PlatformDescription } from "@/components/app/settings/platform-description";
import { PlatformTitle } from "@/components/app/settings/platform-title";
import { PlatformUrl } from "@/components/app/settings/platform-url";

export default function Settings() {
  const className =
    "border-border relative w-full border-t-1 border-b-1 py-5 px-4";

  return (
    <div className="">
      <h2 className="h4 mb-6">Settings</h2>
      <div className="rounded-lg border shadow-xs">
        <PlatformTitle className={className} />
        <PlatformDescription className={className} />
        <PlatformUrl className={className} />
      </div>
    </div>
  );
}
