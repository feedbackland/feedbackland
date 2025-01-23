import "@iframe-resizer/child";
import { getSession } from "@/lib/server/helpers";
import { GetStartedWizard } from "../../components/app/get-started/get-started-wizard";

export default async function RootPage() {
  const session = await getSession();

  return (
    <div className="flex items-center space-x-5">
      <GetStartedWizard userId={session?.user?.id} />
    </div>
  );
}
