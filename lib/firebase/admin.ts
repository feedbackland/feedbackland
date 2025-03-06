import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.split(
            String.raw`\n`,
          ).join("\n"),
        }),
      })
    : getApps()[0];

const adminAuth = getAuth(adminApp);

export { adminApp, adminAuth };
