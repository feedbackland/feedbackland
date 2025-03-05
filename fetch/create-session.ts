import { Session } from "@/lib/auth/session";

export async function fetchCreateSession({
  idToken,
}: {
  idToken: string;
}): Promise<Session> {
  try {
    const response = await fetch(`/auth/create-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    return await response.json();
  } catch (err) {
    throw err;
  }
}
