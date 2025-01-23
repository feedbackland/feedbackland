import "@iframe-resizer/child";
import { CreateOrgForm } from "@/components/app/create-org/create-org-form";

export default async function RootPage() {
  return (
    <div className="flex items-center space-x-5">
      <CreateOrgForm />
    </div>
  );
}
