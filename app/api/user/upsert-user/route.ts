import { getSession } from "@/lib/auth/session";
import { upsertUserQuery as upsertUserQuery } from "@/queries/upsert-user";

export async function POST() {
  try {
    const session = await getSession();

    if (session && session.email && session.name) {
      const user = await upsertUserQuery({
        id: session.uid,
        email: session.email,
        name: session.name,
      });

      return Response.json(user);
    } else {
      throw new Error("No or incomplete session");
    }
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to upsert user" },
      { status: 500 },
    );
  }
}
