import { getSession } from "@/lib/auth/session";
import { upsertUserQuery as upsertUserQuery } from "@/queries/upsert-user";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await getSession();

    if (session && session.email && session.name) {
      const user = await upsertUserQuery({
        id: session.uid,
        email: session.email,
        name: session.name,
      });

      return NextResponse.json(user, { status: 200 });
    } else {
      throw new Error("No session found");
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to upsert user: ${error?.message}` },
      { status: 500 },
    );
  }
}
