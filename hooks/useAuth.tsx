"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/auth/client";
import { Session } from "@/lib/auth/session";
import { fetchCreateSession } from "@/fetch/create-session";
import { fetchUpsertUser } from "@/fetch/upsert-user";
import { fetchDestroySession } from "@/fetch/destroy-session";

type AuthContextType = {
  session: Session | null;
  signInWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<Session>;
  signInAnonymously: () => Promise<Session>;
  signUpWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<Session>;
  signOnWithGoogle: () => Promise<Session>;
  signOnWithMicrosoft: () => Promise<Session>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  signInWithEmail: async () => ({}) as Session,
  signInAnonymously: async () => ({}) as Session,
  signUpWithEmail: async () => ({}) as Session,
  signOnWithGoogle: async () => ({}) as Session,
  signOnWithMicrosoft: async () => ({}) as Session,
  signOut: async () => {},
});

async function setAuthSession({
  user,
  upsert = false,
}: {
  user: User;
  upsert?: boolean;
}) {
  try {
    const idToken = await user.getIdToken();
    const sessionData = await fetchCreateSession({ idToken });
    if (upsert) await fetchUpsertUser();
    return sessionData as Session;
  } catch (err) {
    throw err;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);

  const clearSession = async () => {
    await fetchDestroySession();
    setSession(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed", user);

      if (user) {
        try {
          const authSession = await setAuthSession({ user });

          if (authSession) {
            setSession(authSession);
          } else {
            await clearSession();
          }
        } catch {
          await clearSession();
        }
      } else {
        await clearSession();
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return await setAuthSession({ user });
    } catch (err) {
      throw err;
    }
  };

  const signInAnonymously = async () => {
    try {
      const { user } = await firebaseSignInAnonymously(auth);
      return await setAuthSession({ user, upsert: true });
    } catch (err) {
      throw err;
    }
  };

  const signUpWithEmail = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      return await setAuthSession({ user, upsert: true });
    } catch (err) {
      throw err;
    }
  };

  const signOnWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      return await setAuthSession({ user, upsert: true });
    } catch (err) {
      throw err;
    }
  };

  const signOnWithMicrosoft = async () => {
    try {
      const provider = new OAuthProvider("microsoft.com");
      const { user } = await signInWithPopup(auth, provider);
      return await setAuthSession({ user, upsert: true });
    } catch (err) {
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await fetchDestroySession();
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        signInWithEmail,
        signInAnonymously,
        signUpWithEmail,
        signOnWithGoogle,
        signOnWithMicrosoft,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
