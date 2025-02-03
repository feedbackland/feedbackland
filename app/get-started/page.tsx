import { CreateOrgForm } from "@/components/app/create-org-form";
import { WidgetDocs } from "@/components/app/widget-docs";

export default async function RootPage() {
  return (
    <div className="m-auto mt-10 flex w-full max-w-[600px] flex-col space-y-5">
      <h1>Create your platform</h1>
      <CreateOrgForm />
      <WidgetDocs />
    </div>
  );
}
