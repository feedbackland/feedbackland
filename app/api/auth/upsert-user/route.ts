import { db } from "@/db/db";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      await db
        .insertInto("user")
        .values({
          id: session.uid,
          email: session.email!,
          name: session.name,
        })
        .onConflict((oc) => oc.column("id").doNothing())
        .executeTakeFirstOrThrow();

      return Response.json({ message: "User successfully added" });
    } else {
      throw new Error("No session found");
    }
  } catch (error: any) {
    console.log("error", error);

    return Response.json(
      { error: error?.message || "Failed to upsert user" },
      { status: 500 },
    );
  }
}
