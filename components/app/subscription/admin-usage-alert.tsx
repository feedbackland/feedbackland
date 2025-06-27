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

  // if (
  //   !adminUsage?.limitReached &&
  //   Number(adminUsage?.limit) > 2 &&
  //   Number(adminUsage?.left) === 1
  // ) {
  //   return (
  //     <UsageAlert
  //       type="warning"
  //       className={className}
  //       title="Admin limit almost reached"
  //       description={`You've almost hit your current plan's limit of ${Number(adminUsage?.limit)} admins. Upgrade your plan to invite
  //         more admins.`}
  //     />
  //   );
  // }

  if (adminUsage?.limitReached) {
    return (
      <UsageAlert
        className={className}
        title="Admin limit reached"
        description={`You've hit your current plan's limit of ${Number(adminUsage?.limit)} admins. Please upgrade your plan to invite
          more admins.`}
      />
    );
  }
}
