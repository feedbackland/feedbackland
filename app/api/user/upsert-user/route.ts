import { upsertUserSchema } from "@/lib/schemas";
import { upsertUserQuery as upsertUserQuery } from "@/queries/upsert-user";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { userId, orgSubdomain, email, name, photoURL } =
      upsertUserSchema.parse(bodyRaw);

    const user = await upsertUserQuery({
      userId,
      orgSubdomain,
      email,
      name,
      photoURL,
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Failed to upsert user: ${error instanceof Error ? error?.message : `Unknown error`}`,
      },
      { status: 500 },
    );
  }
}
