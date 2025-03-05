"server-only";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/auth/admin";

export type Session = {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
};

// Session management functions
export async function createSession(idToken: string) {
  try {
    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const { uid, email, picture, displayName } = decodedToken;

    // Create session cookie (2 weeks expiration)
    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 2 weeks in milliseconds

    const sessionData = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    // Set the session cookie
    (await cookies()).set("session", sessionData, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    // Return user data
    return {
      uid,
      email: email || null,
      name: displayName || null,
      photoURL: picture || null,
    } satisfies Session;
  } catch (error) {
    console.error("Error creating session:", error);
    throw new Error("Unauthorized");
  }
}

export async function getSession() {
  try {
    const sessionCookie = (await cookies()).get("session")?.value;

    if (!sessionCookie) {
      return null;
    }

    // Verify the session cookie
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );

    // Fetch additional user data if needed
    const user = await adminAuth.getUser(decodedClaims.uid);

    return {
      uid: user.uid,
      email: user.email || null,
      name: user.displayName || null,
      photoURL: user.photoURL || null,
    } satisfies Session;
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    cookieStore.delete("session");
  }

  return true;
}
