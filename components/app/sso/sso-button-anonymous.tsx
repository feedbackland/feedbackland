"use client";

import { signIn } from "@/lib/client/auth-client";
import { Button } from "@/components/ui/button";
import { VenetianMask } from "lucide-react";

export function SSOButtonAnonymous({
  onSuccess,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
}) {
  const continueAsAnonymous = async () => {
    const callbackURL = window.location.href;

    const { data, error } = await signIn.anonymous();

    if (data && "user" in data && !error) {
      onSuccess({ userId: data?.user?.id });
    }

    if (error) {
      console.log("error", error);
    }
  };

  return (
    <div className="m-auto flex items-center">
      <span className="mr-1 text-sm text-muted-foreground">Or</span>
      <Button
        variant="link"
        onClick={continueAsAnonymous}
        className="p-0 text-sm text-muted-foreground underline hover:text-foreground"
      >
        submit anonymously
      </Button>
    </div>
  );

  // return (
  //   <Button variant="outline" className="w-full" onClick={continueAsAnonymous}>
  //     <VenetianMask className="size-5" />
  //     <span>Continue anonymously</span>
  //   </Button>
  // );
}
