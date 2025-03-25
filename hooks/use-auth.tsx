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
  User,
} from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";

type AuthContextType = {
  session: User | null;
  signInWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<User>;
  signInAnonymously: () => Promise<User>;
  signUpWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<User>;
  signOnWithGoogle: () => Promise<User>;
  signOnWithMicrosoft: () => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  signInWithEmail: async () => ({}) as User,
  signInAnonymously: async () => ({}) as User,
  signUpWithEmail: async () => ({}) as User,
  signOnWithGoogle: async () => ({}) as User,
  signOnWithMicrosoft: async () => ({}) as User,
  signOut: async () => {},
});

const upsertUser = async (user: User) => {
  try {
    const { uid, email, displayName, photoURL } = user;
    const response = await fetch(`/api/user/upsert-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, email, name: displayName, photoURL }),
    });
    const repsonse = await response.json();
    return repsonse as User;
  } catch (err) {
    throw err;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user);
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
      setSession(user);
      return user;
    } catch (err) {
      throw err;
    }
  };

  const signInAnonymously = async () => {
    try {
      const { user } = await firebaseSignInAnonymously(auth);
      await upsertUser(user);
      setSession(user);
      return user;
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
      await upsertUser(user);
      setSession(user);
      return user;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      await upsertUser(user);
      setSession(user);
      return user;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithMicrosoft = async () => {
    try {
      const provider = new OAuthProvider("microsoft.com");
      const { user } = await signInWithPopup(auth, provider);
      await upsertUser(user);
      setSession(user);
      return user;
    } catch (err) {
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      queryClient.invalidateQueries();
      setSession(null);
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
