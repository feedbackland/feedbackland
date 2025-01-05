import { GetStartedWizard } from "@/app/components/get-started-wizard";

export default async function New() {
  return (
    <div>
      <h1>Get started</h1>
      <GetStartedWizard />
    </div>
  );
}
