"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtomValue } from "jotai";
import { previousPathnameAtom } from "@/lib/atoms";
import { useSubdomain } from "@/hooks/use-subdomain";

export const GoBackButton = ({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) => {
  const router = useRouter();
  const subdomain = useSubdomain();
  const previousPathname = useAtomValue(previousPathnameAtom);

  const handleGoBack = () => {
    if (previousPathname) {
      router.back();
    } else {
      router.push(`/${subdomain}`);
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
