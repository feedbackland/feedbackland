import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    console.log("idToken", idToken);

    if (idToken) {
      const user = await createSession(idToken);
      return Response.json(user);
    }

    return Response.json({ error: "Missing ID token" }, { status: 400 });
  } catch (error) {
    console.error("Session creation error:", error);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
