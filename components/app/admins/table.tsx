import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const admins = [
  {
    email: "bleh@blah.com",
    status: "Active",
  },
  {
    email: "zolg@wolg.com",
    status: "Active",
  },
];

export function AdminsTable() {
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
