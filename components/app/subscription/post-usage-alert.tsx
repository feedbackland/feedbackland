"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { usePostUsage } from "@/hooks/use-post-usage";
import { UsageAlert } from "@/components/ui/usage-alert";
import { TriangleAlert } from "lucide-react";

export function PostUsageAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { isAdmin, isLoaded } = useAuth();

  const {
    query: { data: postUsage },
  } = usePostUsage();

  if (isLoaded) {
    if (isAdmin) {
      if (!postUsage?.limitReached && Number(postUsage?.left) <= 10) {
        return (
          <UsageAlert
            type="warning"
            className={className}
            title="Active posts limit almost reached"
            description={`You only have ${Number(postUsage?.left)} active posts left on your current plan. Upgrade your plan to make sure you can keep receiving feedback!`}
          />
        );
      }

      if (postUsage?.limitReached) {
        return (
          <UsageAlert
            className={className}
            title="Active posts limit reached"
            description={`You've reached your plan's limit of ${postUsage?.limit} active posts. To keep on collecting feedback, please upgrade your plan.`}
          />
        );
      }
    }

    if (!isAdmin) {
      if (postUsage?.limitReached) {
        return (
          <Alert className={className}>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <TriangleAlert className="size-4!" />
              Posting feedback is currently disabled. Please contact an
              administrator.
            </AlertDescription>
          </Alert>
        );
      }
    }
  }

  return null;
}
