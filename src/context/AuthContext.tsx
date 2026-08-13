import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { User } from "firebase/auth";

import {
  ensureUserDocument,
  observeAuth,
  signInWithEmail,
  signInWithGoogle,
  logout,
} from "../services/auth";

import { getUserDoc } from "../services/firestore";

import type { UserDoc } from "../types/models";

/* ============================================================
   AUTH CONTEXT TYPE
   ============================================================ */

interface Ctx {
  firebaseUser: User | null;
  profile: UserDoc | null;
  loading: boolean;

  signIn: (
    email: string,
    password: string,
  ) => Promise<void>;

  googleSignIn: () => Promise<void>;

  logout: () => Promise<void>;

  refreshProfile: () => Promise<void>;
}

/* ============================================================
   CONTEXT
   ============================================================ */

const AuthContext = createContext<Ctx | undefined>(
  undefined,
);

/* ============================================================
   AUTH PROVIDER
   ============================================================ */

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState<User | null>(null);

  const [
    profile,
    setProfile,
  ] = useState<UserDoc | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* ==========================================================
     REFRESH FIRESTORE PROFILE
     ----------------------------------------------------------
     Used after an admin changes a user's status/role or when
     the client edits their profile.
     ========================================================== */

  const refreshProfile = useCallback(
    async () => {
      if (!firebaseUser) {
        setProfile(null);
        return;
      }

      try {
        await ensureUserDocument(firebaseUser);

        const userProfile =
          await getUserDoc(firebaseUser.uid);

        setProfile(userProfile);
      } catch (error) {
        console.error(
          "Failed to refresh ARIA profile:",
          error,
        );
      }
    },
    [firebaseUser],
  );

  /* ==========================================================
     FIREBASE AUTH LISTENER
     ----------------------------------------------------------
     Important:
     - Subscribe exactly once.
     - Prevent stale async operations from updating state
       after the component has been replaced/unmounted.
     - Keep loading=true until the Firestore user document
       has been retrieved.
     ========================================================== */

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    const unsubscribe = observeAuth(
      async (user) => {
        if (cancelled) {
          return;
        }

        /* -----------------------------------------------
           No authenticated Firebase user
           ----------------------------------------------- */

        if (!user) {
          setFirebaseUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        /* -----------------------------------------------
           Firebase user exists
           ----------------------------------------------- */

        setFirebaseUser(user);

        try {
          /*
           * Ensure the corresponding Firestore user
           * document exists.
           */
          await ensureUserDocument(user);

          /*
           * Retrieve role/status/profile before we tell
           * the rest of the application that auth loading
           * is complete.
           */
          const userProfile =
            await getUserDoc(user.uid);

          if (cancelled) {
            return;
          }

          setProfile(userProfile);
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Failed to load ARIA user profile:",
              error,
            );

            /*
             * Fail closed:
             * if we cannot verify the user's Firestore
             * profile, do not grant portal access.
             */
            setProfile(null);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      },
    );

    /* -----------------------------------------------
       Cleanup
       ----------------------------------------------- */

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /* ==========================================================
     CONTEXT VALUE
     ========================================================== */

  const value = useMemo<Ctx>(
    () => ({
      firebaseUser,
      profile,
      loading,

      signIn: async (
        email: string,
        password: string,
      ) => {
        await signInWithEmail(
          email,
          password,
        );
      },

      googleSignIn: async () => {
        await signInWithGoogle();
      },

      logout,

      refreshProfile,
    }),
    [
      firebaseUser,
      profile,
      loading,
      refreshProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================================================
   useAuth
   ============================================================ */

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}