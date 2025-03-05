import { destroySession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to destroy session cookie" },
      { status: 500 },
    );
  }
}
