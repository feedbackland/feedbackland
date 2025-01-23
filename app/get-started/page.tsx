import "@iframe-resizer/child";
import { CreateOrgForm } from "@/components/app/create-org/form";

export default async function RootPage() {
  return (
    <div className="flex flex-col space-y-5">
      <h1>Create your platform</h1>
      <CreateOrgForm />
    </div>
  );
}
