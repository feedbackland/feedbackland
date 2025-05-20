"use client";

import { PlatformDescription } from "@/components/app/settings/platform-description";
import { PlatformTitle } from "@/components/app/settings/platform-title";
import { PlatformUrl } from "@/components/app/settings/platform-url";

export default function Settings() {
  const className = "border-border relative w-full border-t-1 border-b-1 py-7";

  return (
    <div className="pt-4">
      <h2 className="mb-4 text-2xl font-semibold">Settings</h2>
      <div className="">
        {/* <h2 className="mb-4 text-2xl font-semibold">Settings</h2> */}
        <PlatformTitle className={className} />
        <PlatformDescription className={className} />
        <PlatformUrl className={className} />
      </div>
    </div>
  );
}
