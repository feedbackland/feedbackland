"use client";
import { PlatformDescription } from "./platform-description";
import { PlatformTitle } from "./platform-title";
import { Indexing } from "./indexing";
export default function Settings() {
  return (
    <div>
      <h2 className="h5 mb-6">Settings</h2>
      <PlatformTitle />
      <PlatformDescription />
      <Indexing />
    </div>
  );
}
