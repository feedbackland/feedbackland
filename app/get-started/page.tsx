import "@iframe-resizer/child";
import { getSession } from "@/app/utils/server/helpers";
import { GetStartedWizard } from "../_components/get-started/get-started-wizard";

export default async function RootPage() {
  const session = await getSession();

  return (
    <div className="flex items-center space-x-5">
      <GetStartedWizard userId={session?.user?.id} />
    </div>
  );
}
