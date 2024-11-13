import { getUserByEmail, getUserByEmail2 } from "@/app//queries";

export default async function Home() {
  const user = await getUserByEmail("Amaya_Berge@example.com");
  const user2 = await getUserByEmail2("Amaya_Berge@example.com");

  return (
    <div className="flex flex-col space-y-3">
      <h1>Test5</h1>
      <div>{user?.name}</div>
      <div>{user2?.name}</div>
    </div>
  );
}
