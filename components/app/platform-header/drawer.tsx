"use client";
import { useAuth } from "@/hooks/use-auth";
import { SignOutButton } from "@/components/app/sign-out";
/**
 * Minimal header shown when the board is embedded in the slide-in drawer widget,
 * in place of the full <PlatformHeader> (board title, navigation, account/theme
 * controls). The drawer is a focused "leave feedback" surface, so it carries
 * only a title — matching the widget's own accessible name ("Share your
 * feedback") — with the feedback form directly beneath it.
 */
export function PlatformHeaderDrawer() {
  const { session } = useAuth();
  return (
    <div className="pb-5">
      <h1 className="text-xl font-bold tracking-tight">Share your feedback</h1>
      {session && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Signed in as {session.user.name}</span>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
