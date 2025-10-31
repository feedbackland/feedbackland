"use client";

import { PlansOverview } from "@/components/app/plans-overview";

export default function AdminPlanPage() {
  return (
    <div className="mt-3 space-y-5">
      {/* <h2 className="h5">Plan</h2> */}
      <PlansOverview />
    </div>
  );
}
