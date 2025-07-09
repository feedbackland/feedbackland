"use client";

import { useAdminLimit } from "@/hooks/use-admin-limit";
import { PlanLimitAlert } from "@/components/ui/plan-limit-alert";

export function AdminsLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: adminLimit },
  } = useAdminLimit();

  if (adminLimit?.limitReached) {
    return (
      <PlanLimitAlert
        className={className}
        title="Admin limit reached"
        description={`You've hit your current plan's limit of ${Number(adminLimit?.limit)} admins. To increase your limit, please upgrade your plan.`}
      />
    );
  }
}
