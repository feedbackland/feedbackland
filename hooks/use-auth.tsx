"use client";
import { createContext, useContext } from "react";
import type { Selectable } from "kysely";
import type { User, AuthSession } from "@/db/schema";
export type Session = {
  user: Selectable<User>;
  session: Selectable<AuthSession>;
} | null;
const unavailable = async (): Promise<Session> => {
  throw new Error("Sign-in is unavailable in this preview");
};
const context = {
  session: null as Session,
  isLoaded: true,
  isAdmin: false,
  authAvailable: false,
  signInWithEmail: async (_input: { email: string; password: string }) =>
    unavailable(),
  signUpWithEmail: async (_input: {
    name: string;
    email: string;
    password: string;
  }) => unavailable(),
  signOnWithGoogle: unavailable,
  signOnWithMicrosoft: unavailable,
  signOut: async () => null,
  refreshSession: () => {},
};
const AuthContext = createContext(context);
export const AuthProvider = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
);
export const useAuth = () => useContext(AuthContext);
