import { SignUpForm } from "@/app/components/sign-up-form";

export default async function Home() {
  return (
    <div className="100vw flex justify-center p-10">
      <SignUpForm />
    </div>
  );
}
