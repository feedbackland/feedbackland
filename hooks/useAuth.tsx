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
import { UserSession } from "@/lib/auth/session";

type AuthContextType = {
  session: UserSession | null;
  signInWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<UserSession>;
  signInAnonymously: () => Promise<UserSession>;
  signUpWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<UserSession>;
  signOnWithGoogle: () => Promise<UserSession>;
  signOnWithMicrosoft: () => Promise<UserSession>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  signInWithEmail: async () => ({}) as UserSession,
  signInAnonymously: async () => ({}) as UserSession,
  signUpWithEmail: async () => ({}) as UserSession,
  signOnWithGoogle: async () => ({}) as UserSession,
  signOnWithMicrosoft: async () => ({}) as UserSession,
  signOut: async () => {},
});

async function createSession({ idToken }: { idToken: string }) {
  const response = await fetch("/api/auth/create-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  return response.json();
}

async function upsertUser() {
  try {
    await fetch("/api/auth/upsert-user", {
      method: "POST",
    });
  } catch (err) {
    throw err;
  }
}
async function getSession() {
  try {
    const response = await fetch("/api/auth/get-session");
    return response.json();
  } catch (err) {
    throw err;
  }
}

async function destroySession() {
  try {
    const response = await fetch("/api/auth/destroy-session", {
      method: "POST",
    });
    return response.json();
  } catch (err) {
    throw err;
  }
}

async function setAuthSession({ user }: { user: User }) {
  console.log("setAuthSession");

  try {
    const idToken = await user.getIdToken();
    const sessionData = await createSession({ idToken });
    await upsertUser();
    return sessionData as UserSession;
  } catch (err) {
    throw err;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const authSession = await setAuthSession({ user });

          if (authSession) {
            setSession(authSession);
          } else {
            await destroySession();
            setSession(null);
          }
        } catch (error) {
          console.error("Error creating session:", error);
          await destroySession();
          setSession(null);
        }
      } else {
        await destroySession();
        setSession(null);
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
      return await setAuthSession({ user });
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
      return await setAuthSession({ user });
    } catch (err) {
      throw err;
    }
  };

  const signOnWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      return await setAuthSession({ user });
    } catch (err) {
      throw err;
    }
  };

  const signOnWithMicrosoft = async () => {
    try {
      const provider = new OAuthProvider("microsoft.com");
      const { user } = await signInWithPopup(auth, provider);
      return await setAuthSession({ user });
    } catch (err) {
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await destroySession();
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
