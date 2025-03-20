"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const GoBackButton = ({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) => {
  const router = useRouter();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  const handleGoBack = () => {
    router.back();
  };

  return (
    <Button
      size="sm"
      onClick={handleGoBack}
      // variant="link"
      // className={cn("size-fit p-0", className)}
      variant="secondary"
      className={cn("", className)}
    >
      <ArrowLeft className="size-4" />
      Back to overview
    </Button>
  );
};
