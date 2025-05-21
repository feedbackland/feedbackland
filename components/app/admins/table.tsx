"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdmins } from "@/hooks/use-admins";

export function AdminsTable() {
  const {
    query: { data: admins },
  } = useAdmins();

  if (admins && admins.length > 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="">Email</TableHead>
            <TableHead className="">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => (
            <TableRow key={admin.email}>
              <TableCell className="">{admin.email}</TableCell>
              <TableCell className="">{admin.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
}
