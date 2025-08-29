"use client";

import { AdminsInvite } from "./invite";
import { AdminsTable } from "./table";

export function Admins() {
  return (
    <div className="">
      <h2 className="h5 mb-6">Admins</h2>
      <div className="space-y-8">
        <AdminsInvite />
        <AdminsTable />
      </div>
    </div>
  );
}
