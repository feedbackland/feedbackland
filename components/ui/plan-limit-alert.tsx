"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui//button";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import Link from "next/link";

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
  const platformUrl = usePlatformUrl();

  return (
    <Alert
      className={cn(
        "border-primary flex flex-col items-start justify-between gap-5 border sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <AlertTriangleIcon
          className={cn("text-primary hidden size-6 shrink-0 sm:block")}
        />
        <div className="flex flex-col items-stretch space-y-1">
          {title && <AlertTitle>{title}</AlertTitle>}
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
      </div>
      <Button size="sm" variant="default">
        <Link href={`${platformUrl}/admin/plan`}>Upgrade Now</Link>
      </Button>
    </Alert>
  );
}
