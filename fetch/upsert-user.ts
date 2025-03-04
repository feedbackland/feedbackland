import { User } from "@/db/schema";

export async function upsertUserFetch(): Promise<User> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/user/upsert-user`,
      {
        method: "POST",
      },
    );
    return response.json();
  } catch (err) {
    throw err;
  }
}
