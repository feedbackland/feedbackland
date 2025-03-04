import { Session } from "@/lib/auth/session";

export async function createSessionFetch({
  idToken,
}: {
  idToken: string;
}): Promise<Session> {
  try {
    console.log(
      "createSessionFetch() called",
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/create-session`,
    );

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/create-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      },
    );

    return await response.json();
  } catch (err) {
    throw err;
  }
}
