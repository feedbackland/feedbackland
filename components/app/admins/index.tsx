"use client";

import { AdminsInvite } from "./invite";
import { AdminsTable } from "./table";

export function Admins() {
  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Admins</h2>
      <div className="space-y-8">
        <AdminsInvite />
        <AdminsTable />
      </div>
    </div>
  );
}
