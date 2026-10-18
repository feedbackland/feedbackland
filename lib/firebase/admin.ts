import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getIsSelfHosted } from "../utils";
import { lazyDelegate } from "../lazy-delegate";

const getAdminApp = () =>
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

const adminAuth = lazyDelegate(() => getAuth(getAdminApp()));

const adminDatabase = lazyDelegate(() => {
  if (getIsSelfHosted("server")) {
    throw new Error(
      "Legacy realtime database is unavailable in self-hosted mode",
    );
  }
  return getDatabase(getAdminApp());
});

export { adminAuth, adminDatabase };
