"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Session } from "@/hooks/use-auth";

export function SSOButtonAnonymous({
  onSuccess,
}: {
  onSuccess: (session: Session) => void;
}) {
  const { signInAnonymously } = useAuth();

  const continueAsAnonymous = async () => {
    try {
      const session = await signInAnonymously();
      onSuccess(session);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="m-auto flex items-center">
      <span className="text-foreground mr-1 text-sm">Or</span>
      <Button
        variant="link"
        onClick={continueAsAnonymous}
        className="p-0 underline"
      >
        submit anonymously
      </Button>
    </div>
  );
}
