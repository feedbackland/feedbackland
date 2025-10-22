"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth } from "@/lib/firebase/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { User, Org, UserOrg } from "@/db/schema";
import { Selectable } from "kysely";
import { getSubdomain } from "@/lib/utils";
import { UpsertUser } from "@/lib/typings";
import { usePathname, useRouter } from "next/navigation";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useUserSession } from "@/hooks/use-user-session";

export type Session = {
  user: Selectable<User>;
  userOrg: Selectable<UserOrg>;
  org: Selectable<Org>;
} | null;

type AuthContextType = {
  session: Session;
  isLoaded: boolean;
  isAdmin: boolean;
  signInWithEmail: ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => Promise<Session>;
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
  signOut: () => Promise<null>;
  refreshSession: () => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoaded: false,
  isAdmin: false,
  signInWithEmail: async () => ({}) as Session,
  signUpWithEmail: async () => ({}) as Session,
  signOnWithGoogle: async () => ({}) as Session,
  signOnWithMicrosoft: async () => ({}) as Session,
  signOut: async () => null,
  refreshSession: () => {},
});

const upsertUser = async ({
  userId,
  email,
  name,
  photoURL,
}: {
  userId: string;
  email: string;
  name: string | null;
  photoURL: string | null;
}) => {
  try {
    const orgSubdomain =
      sessionStorage?.getItem("orgSubdomain") || getSubdomain();

    if (!orgSubdomain) {
      throw new Error("Missing email or org subdomain");
    }

    const input: UpsertUser = {
      userId,
      email,
      name,
      photoURL,
      orgSubdomain,
    };

    const response = await fetch("/api/user/upsert-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const session: Session = await response.json();

    if (session) {
      return session;
    } else {
      throw new Error("upsertUser did not return anything");
    }
  } catch (err) {
    throw err;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const pathname = usePathname();

  const [session, setSession] = useState<Session>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    query: { refetch: refetchUserSession },
  } = useUserSession({ enabled: false });

  const destroySession = useCallback(() => {
    queryClient.invalidateQueries();
    setSession(null);
    setIsLoaded(true);
  }, [setSession, setIsLoaded, queryClient]);

  const isAdmin = session?.userOrg?.role === "admin";

  const createSession = useCallback(
    async ({
      userId,
      email,
      name,
      photoURL,
    }: {
      userId: string;
      email: string;
      name: string | null;
      photoURL: string | null;
    }) => {
      let newSession: Session = null;

      queryClient.invalidateQueries();

      try {
        const { user, userOrg, org } = await upsertUser({
          userId,
          email,
          name,
          photoURL,
        });

        newSession = {
          user: user,
          userOrg: userOrg,
          org: org,
        };

        setSession(newSession);
        setIsLoaded(true);
      } catch {
        destroySession();
      }

      return newSession;
    },
    [setSession, queryClient, destroySession],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.uid) {
        createSession({
          userId: user.uid,
          email: user.email || `${user.uid}@no-email.com`,
          name: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        destroySession();
      }
    });

    return () => unsubscribe();
  }, [createSession, destroySession]);

  const signInWithEmail = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const session = await createSession({
        userId: user.uid,
        email: user.email || `${user.uid}@no-email.com`,
        name: user.displayName,
        photoURL: user.photoURL,
      });
      return session;
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
      await updateProfile(user, { displayName: name });
      const session = await createSession({
        userId: user.uid,
        email,
        name,
        photoURL: user.photoURL,
      });
      return session;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      const session = await createSession({
        userId: user.uid,
        email: user.email || `${user.uid}@no-email.com`,
        name: user.displayName,
        photoURL: user.photoURL,
      });
      return session;
    } catch (err) {
      throw err;
    }
  };

  const signOnWithMicrosoft = async () => {
    try {
      const provider = new OAuthProvider("microsoft.com");
      const { user } = await signInWithPopup(auth, provider);
      const session = await createSession({
        userId: user.uid,
        email: user.email || `${user.uid}@no-email.com`,
        name: user.displayName,
        photoURL: user.photoURL,
      });
      return session;
    } catch (err) {
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);

      destroySession();

      if (pathname.includes("/admin") && platformUrl) {
        router.push(platformUrl);
      }

      return null;
    } catch (err) {
      throw err;
    }
  };

  const refreshSession = async () => {
    const { data: session } = await refetchUserSession();

    if (session) {
      setSession(session);
    } else {
      destroySession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoaded,
        isAdmin,
        signInWithEmail,
        signUpWithEmail,
        signOnWithGoogle,
        signOnWithMicrosoft,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
