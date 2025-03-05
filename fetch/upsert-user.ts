import { User } from "@/db/schema";

export async function fetchUpsertUser() {
  try {
    const response = await fetch(`/user/upsert-user`, {
      method: "POST",
    });
    const user = await response.json();
    return user as User;
  } catch (err) {
    throw err;
  }
}
