import { SignInForm } from "@/app/components/sign-in-form";

export default async function Home() {
  return (
    <div className="100vw flex justify-center p-10">
      <SignInForm />
    </div>
  );
}
