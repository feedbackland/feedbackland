import { ReactNode } from "react";
import AdminRoot from "@/components/app/admin-root";
import PlatformRoot from "@/components/app/platform-root";
import { BoardState } from "@/components/app/board-state";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformRoot>
      <BoardState />
      <AdminRoot>{children}</AdminRoot>
    </PlatformRoot>
  );
}
