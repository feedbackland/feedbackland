"use client";
import { Button } from "@/components/ui/button";
export function ForgotPasswordForm({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="space-y-4">
      <p role="status">
        Password recovery is unavailable on this board. Contact its
        administrator for help accessing your account.
      </p>
      <Button type="button" variant="secondary" onClick={onGoBack}>
        Go back
      </Button>
    </div>
  );
}
