"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";

export function SSOButtonAnonymous({
  onSuccess,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const continueAsAnonymous = async () => {
    const { data, error } = await signIn.anonymous();

    if (data && "user" in data && !error) {
      onSuccess({ userId: data?.user?.id });
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
