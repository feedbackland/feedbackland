"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { previousPathnameAtom } from "@/lib/atoms";
import { useAtomValue } from "jotai";

export const GoBackButton = ({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) => {
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const previousPathname = useAtomValue(previousPathnameAtom);

  const handleGoBack = () => {
    if (previousPathname && window.history.length > 1) {
      window.history.go(-1);
    } else if (platformUrl) {
      router.push(platformUrl);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleGoBack}
      variant="secondary"
      className={cn("", className)}
    >
      <ArrowLeft />
      Back
    </Button>
  );
};
