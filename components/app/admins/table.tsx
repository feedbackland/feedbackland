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
import { AdminsTableLoading } from "./table-loading";

export function AdminsTable() {
  const {
    query: { data: admins, isPending, isSuccess },
  } = useAdmins();

  if (isPending) {
    return <AdminsTableLoading />;
  }

  if (isSuccess && admins && admins.length > 0) {
    return (
      <>
        <div className="bg-background rounded-md border shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="">Admin</TableHead>
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
        </div>
      </>
    );
  }
}
