"use client";

import { useAdminLimit } from "@/hooks/use-admin-limit";
import { PlanLimitAlert } from "@/components/ui/plan-limit-alert";

export function AdminLimitAlert({
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
        description={`You've hit your current plan's limit of ${Number(adminLimit?.limit)} admins. Please upgrade your plan to invite
          more admins.`}
      />
    );
  }
}
