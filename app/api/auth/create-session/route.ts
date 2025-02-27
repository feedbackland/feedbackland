import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    console.log("idToken", idToken);

    if (idToken) {
      const user = await createSession(idToken);
      return Response.json(user);
    } else {
      throw new Error("Missing ID token");
    }
  } catch (error) {
    console.log("Error creating session:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error for api/auth/create-session";
    return Response.json({ error: message }, { status: 400 });
  }
}
