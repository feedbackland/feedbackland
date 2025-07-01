"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubscriptionButton } from "@/components/app/subscription-button";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "lucide-react";

export function PlanLimitAlert({
  title,
  description,
  className,
  type = "alert",
}: {
  title?: string;
  description?: string;
  className?: React.ComponentProps<"div">["className"];
  type?: "alert" | "warning";
}) {
  return (
    <Alert
      className={cn(
        "border-destructive flex flex-col items-start justify-between gap-5 border sm:flex-row sm:items-center",
        type === "warning" && "border-yellow-500",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <AlertTriangleIcon
          className={cn(
            "text-destructive hidden size-6 shrink-0 sm:block",
            type === "warning" && "text-yellow-500!",
          )}
        />
        <div className="flex flex-col items-stretch space-y-1">
          {title && <AlertTitle>{title}</AlertTitle>}
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
      </div>
      <SubscriptionButton
        size="sm"
        variant="default"
        buttonText="Upgrade Now"
      />
    </Alert>
  );
}
