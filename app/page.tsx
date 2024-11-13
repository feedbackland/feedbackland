import { getUserByEmail } from "@/app//queries";

export default async function Home() {
  const user = await getUserByEmail("Amaya_Berge@example.com");
  return <div className="">{user?.name}</div>;
}
