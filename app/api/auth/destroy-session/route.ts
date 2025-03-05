import { destroySession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to destroy session cookie" },
      { status: 500 },
    );
  }
}
