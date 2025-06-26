"use client";

import { useAdminUsage } from "@/hooks/use-admin-usage";
import { UsageAlert } from "@/components/ui/usage-alert";

export function AdminUsageAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: adminUsage },
  } = useAdminUsage();

  if (adminUsage?.limitReached) {
    return (
      <UsageAlert
        className={className}
        title="Admin limit reached"
        description={`You've hit your current plan's limit of ${adminUsage.limit} admins. Please upgrade your plan to invite
          more admins.`}
      />
    );
  }
}
