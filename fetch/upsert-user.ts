import { User } from "@/db/schema";

export async function upsertUserFetch() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/user/upsert-user`,
      {
        method: "POST",
      },
    );
    const user = await response.json();
    return user as User;
  } catch (err) {
    throw err;
  }
}
