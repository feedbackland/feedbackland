"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdmins } from "@/hooks/use-admins";
import { AdminsTableRow } from "./table-row";

export function AdminsTable() {
  const {
    query: { data: admins },
  } = useAdmins();

  console.log("admins", admins);

  if (admins && admins.length > 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="">Email</TableHead>
            <TableHead className="">Status</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => (
            <AdminsTableRow
              key={admin.userId || admin.adminInviteId}
              admin={admin}
            />
          ))}
        </TableBody>
      </Table>
    );
  } else {
    return <div className="py-4 text-center">No admins found.</div>; // Added fallback UI
  }
}
