"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  User as firebaseUser,
} from "firebase/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export interface Session {
  uid: string;
}

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
    name,
    email,
    password,
  }: {
    name: string;
    email: string;
    password: string;
  }) => Promise<Session>;
  signOnWithGoogle: () => Promise<Session>;
  signOnWithMicrosoft: () => Promise<Session>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  signInWithEmail: async () => ({}) as firebaseUser,
  signInAnonymously: async () => ({}) as firebaseUser,
  signUpWithEmail: async () => ({}) as firebaseUser,
  signOnWithGoogle: async () => ({}) as firebaseUser,
  signOnWithMicrosoft: async () => ({}) as firebaseUser,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [session, setSession] = useState<Session | null>(null);

  const upsertUser = useMutation(trpc.upsertUser.mutationOptions({}));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.uid) {
        setSession({ uid: user?.uid });
      } else {
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
      await upsertUser.mutateAsync({
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      });
      setSession({ uid: user.uid });
      return { uid: user.uid } satisfies Session;
    } catch (err) {
      throw err;
    }
  };

  const signInAnonymously = async () => {
    try {
      const { user } = await firebaseSignInAnonymously(auth);
      await upsertUser.mutateAsync({
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      });
      setSession({ uid: user.uid });
      return { uid: user.uid } satisfies Session;
    } catch (err) {
      throw err;
    }
  };

  const signUpWithEmail = async ({
    name,
    email,
    password,
  }: {
    name: string;
    email: string;
    password: string;
  }) => {
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await upsertUser.mutateAsync({
        name,
        photoURL: user.photoURL,
        email: user.email,
      });
      setSession({ uid: user.uid });
      return { uid: user.uid } satisfies Session;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      await upsertUser.mutateAsync({
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      });
      setSession({ uid: user.uid });
      return { uid: user.uid } satisfies Session;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithMicrosoft = async () => {
    try {
      const provider = new OAuthProvider("microsoft.com");
      const { user } = await signInWithPopup(auth, provider);
      await upsertUser.mutateAsync({
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      });
      setSession({ uid: user.uid });
      return { uid: user.uid } satisfies Session;
    } catch (err) {
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      queryClient.invalidateQueries();
      setSession(null);
      return;
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
