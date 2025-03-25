import { upsertUserQuery as upsertUserQuery } from "@/queries/upsert-user";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).optional(),
  photoURL: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { uid, email, name, photoURL } = schema.parse(bodyRaw);

    const user = await upsertUserQuery({
      id: uid,
      email,
      name: name || null,
      photoURL: photoURL || null,
    });

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to upsert user: ${error?.message}` },
      { status: 500 },
    );
  }
}
