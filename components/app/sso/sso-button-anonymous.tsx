"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SSOButtonAnonymous({
  onSuccess,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const { signInAnonymously } = useAuth();

  const continueAsAnonymous = async () => {
    try {
      const { uid } = await signInAnonymously();
      onSuccess({ userId: uid });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="m-auto flex items-center">
      <span className="mr-1 text-sm text-foreground">Or</span>
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
