"use client";

import { Plan } from "./plan";

export function PlansOverview() {
  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <Plan planName="free" />
      <Plan planName="pro" />
    </div>
  );
}
