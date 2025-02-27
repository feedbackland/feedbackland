import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  if (session) {
    return Response.json(session);
  } else {
    return Response.json(
      {
        message: "Session cookie not found",
      },
      { status: 404 },
    );
  }
}
