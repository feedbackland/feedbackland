"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtomValue } from "jotai";
import { previousPathnameAtom } from "@/lib/atoms";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      size="sm"
      onClick={handleGoBack}
      variant="link"
      className={cn(
        "text-muted-foreground hover:text-primary w-fit px-0 hover:no-underline",
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <ArrowLeft className="size-3.5" />
        <span className="">Back</span>
      </span>
    </Button>
  );

  // return (
  //   <Button
  //     size="sm"
  //     onClick={handleGoBack}
  //     variant="secondary"
  //     className={cn("", className)}
  //   >
  //     <ArrowLeft className="size-4" />
  //     <span className="hidden sm:block">Back</span>
  //   </Button>
  // );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          onClick={handleGoBack}
          variant="outline"
          className={cn("size-8", className)}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Go back</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Go back to overview</TooltipContent>
    </Tooltip>
  );
};
