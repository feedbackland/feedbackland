import { createSession } from "@/lib/auth/session";
import { z } from "zod";

const schema = z.object({
  idToken: z
    .string()
    .min(1)
    .describe("The idToken of the authenticated firebase user."),
});

export async function POST(request: Request) {
  try {
    const bodyRaw = await request.json();
    const { idToken } = schema.parse(bodyRaw);

    if (idToken) {
      const session = await createSession(idToken);
      return Response.json(session);
    } else {
      throw new Error("Missing ID token");
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error for api/auth/create-session";
    return Response.json({ error: message }, { status: 500 });
  }
}
