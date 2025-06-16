import { ReactNode } from "react";
import AdminRoot from "@/components/app/admin-root";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>;
}
