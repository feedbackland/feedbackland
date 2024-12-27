import { SignUp } from "@/app/components/sign-up";

export default async function Home() {
  return (
    <div className="100vw flex justify-center p-10">
      <SignUp />
    </div>
  );
}
