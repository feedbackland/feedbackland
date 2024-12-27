import { getSubdomain, getSession } from "@/app/utils/helpers";
import { SignIn } from "@/app/components/sign-in";

export default async function Home() {
  return (
    <div className="100vw flex justify-center p-10">
      <SignIn />
    </div>
  );
}
