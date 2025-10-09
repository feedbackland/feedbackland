"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "lucide-react";
import { SubscriptionButton } from "../app/subscription-button";

export function UpgradeAlert({
  title,
  description,
  className,
  buttonText,
}: {
  title?: string;
  description?: string;
  buttonText?: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <Alert
      className={cn(
        "border-primary flex flex-col items-start justify-between gap-5 border sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <AlertTriangleIcon
          className={cn("text-primary hidden size-5 shrink-0 sm:block")}
        />
        <div className="flex flex-col items-stretch space-y-1">
          {title && <AlertTitle className="font-semibold">{title}</AlertTitle>}
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
      </div>
      <SubscriptionButton buttonText={buttonText || "Upgrade"} />
    </Alert>
  );
}
