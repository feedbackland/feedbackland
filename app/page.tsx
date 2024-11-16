import { getUserByEmail } from "@/app//queries";

export default async function Home() {
  const user = await getUserByEmail("bleh@blah.com");

  return (
    <div className="flex flex-col space-y-3">
      <h1>Test5</h1>
      <div>{user?.name}</div>
    </div>
  );
}
