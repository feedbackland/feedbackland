import { CreateOrgForm } from "@/components/app/create-org-form";

export default async function RootPage() {
  return (
    <div className="max-w-[600px] w-full m-auto mt-10 flex flex-col space-y-5">
      <h1>Create your platform</h1>
      <CreateOrgForm />
    </div>
  );
}
