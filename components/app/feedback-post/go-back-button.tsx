"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtomValue } from "jotai";
import { previousPathnameAtom } from "@/lib/atoms";
import { usePlatformUrl } from "@/hooks/use-platform-url";

export const GoBackButton = ({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) => {
  const router = useRouter();
  const previousPathname = useAtomValue(previousPathnameAtom);
  const platformUrl = usePlatformUrl();

  const handleGoBack = () => {
    if (previousPathname) {
      router.back();
    } else if (platformUrl) {
      router.push(platformUrl);
    }
  };

  return (
    <Button
      size="icon"
      onClick={handleGoBack}
      variant="outline"
      className={cn("size-8", className)}
    >
      <ArrowLeft className="size-4" />
      <span className="sr-only">Go back</span>
    </Button>
  );
};
