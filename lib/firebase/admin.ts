import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

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
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      })
    : getApps()[0];

const adminAuth = getAuth(adminApp);

const adminDatabase =
  process?.env?.SELF_HOSTED !== "true" ? getDatabase(adminApp) : undefined;

export { adminAuth, adminDatabase };
