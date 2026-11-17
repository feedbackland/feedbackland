"use client";
import { PlatformDescription } from "./platform-description";
import { PlatformTitle } from "./platform-title";
import { Logo } from "./logo";
import Link from "next/link";
import { Indexing } from "./indexing";
export default function Settings() {
  return (
    <div>
      <h2 className="h5 mb-6">Settings</h2>
      <nav className="mb-5 flex gap-4" aria-label="Settings sections">
        <strong>Board</strong>
        <Link className="underline" href="/admin/settings/ai">
          AI
        </Link>
      </nav>
      <PlatformTitle />
      <PlatformDescription />
      <Logo />
      <Indexing />
    </div>
  );
}
