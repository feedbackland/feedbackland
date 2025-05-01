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
  const platfromUrl = usePlatformUrl();

  const handleGoBack = () => {
    if (previousPathname) {
      router.back();
    } else {
      router.push(platfromUrl as string);
    }
  };

  return (
    <Button
      size="icon"
      onClick={handleGoBack}
      variant="ghost"
      className={cn("size-8", className)}
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
};
