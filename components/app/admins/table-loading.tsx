import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminsTableLoading() {
  const numberOfRows = 3;

  return (
    <div className="rounded-md border shadow-xs">
      <Table className="">
        <TableHeader>
          <TableRow className="">
            <TableHead className="w-[60%]">
              <Skeleton className="h-5 w-20" />
            </TableHead>
            <TableHead className="w-[40%]">
              <Skeleton className="h-5 w-20" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: numberOfRows }).map((_, index) => (
            <TableRow key={index} className="">
              <TableCell>
                <Skeleton className="h-4" />
              </TableCell>
              <TableCell className="">
                <Skeleton className="h-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
